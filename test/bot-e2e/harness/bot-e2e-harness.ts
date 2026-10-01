import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { Redis } from 'ioredis';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';

import { SocialType } from '@my-common/constants';

import type { UserSocial } from '../../../src/models/user/entity/user-social.entity';
import { FakeScheduleApi } from '../fake-api/schedule-api.fake';
import { FakeTelegramApi } from '../fake-api/telegram-api.fake';
import { FakeVkApi } from '../fake-api/vk-api.fake';

const E2E_DATABASE_NAME = /(?:-|_)e2e$/;

/**
 * Поднимает настоящее Nest-приложение после fake API, иначе environment
 * успеет закэшировать реальный адрес транспорта при первом import AppModule.
 */
export class BotE2eHarness {
  private constructor(
    public readonly app: INestApplication,
    public readonly telegram: FakeTelegramApi,
    public readonly vk: FakeVkApi,
    public readonly schedule: FakeScheduleApi,
  ) {}

  public static async start() {
    assertE2eEnvironment();

    const [telegram, vk, schedule] = await Promise.all([
      FakeTelegramApi.start(),
      FakeVkApi.start(),
      FakeScheduleApi.start(),
    ]);

    try {
      configureE2eRuntime({ telegram, vk, schedule });
      await runE2eMigrations();
      await clearE2eState();

      const [{ AppModule }, { TelegramService }, { VkService }] =
        await Promise.all([
          import('../../../src/models/app/app.module'),
          import('../../../src/models/telegram/telegram.service'),
          import('../../../src/models/vk/vk.service'),
        ]);
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app = module.createNestApplication();
      await app.init();

      await Promise.all([telegram.waitForPolling(), vk.waitForPolling()]);
      // Ensure concrete services are instantiated and available to teardown.
      app.get(TelegramService);
      app.get(VkService);

      return new BotE2eHarness(app, telegram, vk, schedule);
    } catch (error) {
      await Promise.allSettled([
        telegram.close(),
        vk.close(),
        schedule.close(),
      ]);
      throw error;
    }
  }

  /**
   * Возвращает контур в исходное состояние между test-case без перезапуска
   * Nest и long polling. Это project-level helper: он знает об E2E БД и
   * Redis, поэтому не является кандидатом для Nest transport-библиотек.
   */
  public async resetScenario() {
    // Telegram/VK завершают middleware асинхронно после polling response.
    // Например, /start сначала отдаёт основную keyboard, а затем welcome card.
    // Не очищаем БД и recorded calls между этими двумя исходящими запросами.
    await this.waitForTransportIdle();
    await clearE2eState();
    this.telegram.reset();
    this.vk.reset();
    this.schedule.reset();
  }

  /** Проверяет persistent результат middleware, не раскрывая Repository в сценариях. */
  public async getUserSocial(
    social: SocialType,
    socialId: number,
  ): Promise<UserSocial | null> {
    const { UserService } =
      await import('../../../src/models/user/user.service');
    return await this.app.get(UserService).findBySocialId(social, socialId);
  }

  /** Ожидает commit из detached transport middleware, а не угадывает delay. */
  public async waitForUserSocial(
    social: SocialType,
    socialId: number,
    predicate: (userSocial: UserSocial) => boolean = () => true,
    timeoutMs = 3e3,
  ) {
    const startedAt = Date.now();
    let lastUserSocial: UserSocial | null = null;
    do {
      const userSocial = await this.getUserSocial(social, socialId);
      lastUserSocial = userSocial;
      if (userSocial && predicate(userSocial)) return userSocial;
      await delay(25);
    } while (Date.now() - startedAt < timeoutMs);

    throw new Error(
      `Timed out waiting for persisted ${social} userSocial=${socialId}; last=${JSON.stringify(
        lastUserSocial && {
          hasDM: lastUserSocial.hasDM,
          isBlockedBot: lastUserSocial.isBlockedBot,
          groupName: lastUserSocial.groupName,
        },
      )}`,
    );
  }

  /**
   * Искусственно старит уже полученный снимок, чтобы E2E проверял путь
   * stale-if-error от пользовательского update до ответа. Это осознанно
   * product-specific helper: общий transport package не должен знать ключи
   * ScheduleService.
   */
  public async ageScheduleCache(
    targetType: 'group' | 'teacher',
    targetId: string | number,
    ageMs: number,
  ) {
    const { RedisService } =
      await import('../../../src/models/redis/redis.service');
    const cacheKey = `schedule:${targetType}:${String(targetId).toLowerCase()}`;
    const redis = this.app.get(RedisService).redis;
    const raw = await redis.get(cacheKey);
    if (!raw) {
      throw new Error(`Cannot age missing Schedule cache entry ${cacheKey}`);
    }

    const entry = JSON.parse(raw) as { fetchedAt?: string; items?: unknown[] };
    if (!Array.isArray(entry.items)) {
      throw new Error(`Schedule cache entry ${cacheKey} has unexpected shape`);
    }
    entry.fetchedAt = new Date(Date.now() - ageMs).toISOString();
    const ttlMs = await redis.pttl(cacheKey);
    if (ttlMs > 0) {
      await redis.set(cacheKey, JSON.stringify(entry), 'PX', ttlMs);
    } else {
      await redis.set(cacheKey, JSON.stringify(entry));
    }
  }

  public async close() {
    try {
      const [{ TelegramService }, { VkService }] = await Promise.all([
        import('../../../src/models/telegram/telegram.service'),
        import('../../../src/models/vk/vk.service'),
      ]);
      this.app.get(TelegramService).bot.stop('bot-e2e shutdown');
      await this.app.get(VkService).bot.updates.stop();
    } catch {
      // Failed bootstrap is handled by the fake server cleanup below.
    }

    // vk-io dispatches a long-poll update without awaiting its middleware
    // promise. Дожидаемся quiet period перед закрытием Redis и fake socket.
    await this.waitForTransportIdle();
    // All pollers have already received stop() above. Let Nest dispose Redis,
    // queues and transport resources before tearing down their fake endpoints.
    await this.app.close();

    // The fake servers close any remaining idle keep-alive socket after Nest
    // releases its clients, so a sequential suite does not inherit handles.
    await Promise.all([
      this.telegram.close(),
      this.vk.close(),
      this.schedule.close(),
    ]);
  }

  /**
   * Транспортные SDK не отдают promise, которое означает «все listener-ы
   * завершены»: polling получил update раньше их async middleware. Поэтому
   * harness ждёт короткий период без новых Bot API calls, а не фиксированную
   * паузу. Это относится к project fake servers; будущий lifecycle seam в
   * `nestjs-telega`/`nestjs-vk` сможет дать более точный drain signal.
   */
  public async waitForTransportIdle(quietMs = 250, timeoutMs = 5e3) {
    let knownCallCount = this.telegram.calls.length + this.vk.calls.length;
    if (knownCallCount === 0) return;

    const startedAt = Date.now();
    let quietSince = startedAt;
    while (Date.now() - startedAt < timeoutMs) {
      await delay(25);
      const callCount = this.telegram.calls.length + this.vk.calls.length;
      if (callCount !== knownCallCount) {
        knownCallCount = callCount;
        quietSince = Date.now();
        continue;
      }
      if (Date.now() - quietSince >= quietMs) return;
    }

    throw new Error(
      'Timed out waiting for transport middleware to become idle',
    );
  }
}

const assertE2eEnvironment = () => {
  const database = process.env.POSTGRES_DATABASE || '';
  const redisPrefix = process.env.REDIS_PREFIX || '';

  if (process.env.E2E_TEST_MODE !== 'true') {
    throw new Error('Bot E2E refuses to run without E2E_TEST_MODE=true');
  }
  if (!E2E_DATABASE_NAME.test(database)) {
    throw new Error(
      `Bot E2E refuses to clear PostgreSQL database "${database}"; expected -e2e or _e2e suffix`,
    );
  }
  if (!redisPrefix.includes('e2e')) {
    throw new Error(
      `Bot E2E refuses to clear Redis prefix "${redisPrefix}"; it must contain "e2e"`,
    );
  }
};

/** Задаётся до DataSource import: environment кэширует env-значения как module constants. */
const configureE2eRuntime = ({
  telegram,
  vk,
  schedule,
}: Pick<BotE2eHarness, 'telegram' | 'vk' | 'schedule'>) => {
  // E2E uses the same transport seams as deployment. Both pollers share
  // one Nest process and therefore one database and Redis namespace.
  process.env.SOCIAL_TELEGRAM_BOT_TOKEN =
    '900001:AAE2eFakeTelegramTokenForLocalTests000000';
  process.env.SOCIAL_TELEGRAM_API_ROOT = telegram.url;
  process.env.SCHEDULE_API_URL = schedule.url;
  process.env.SOCIAL_VK_GROUP_TOKEN = 'e2e-vk-group-token';
  process.env.SOCIAL_VK_GROUP_ID = String(vk.groupId);
  process.env.SOCIAL_VK_API_BASE_URL = `${vk.url}/method`;
  // Recovery has its own service specs. Default it off here so existing local
  // .env.e2e files remain safe after this option was introduced.
  process.env.E2E_SKIP_VK_UNREAD_RECOVERY ??= 'true';
};

/** Запускает обычные TypeORM migrations только для защищённой E2E БД. */
const runE2eMigrations = async () => {
  if (process.env.E2E_RUN_MIGRATIONS === 'false') {
    return;
  }

  const { default: dataSource } = await import('../../../src/data-source');
  try {
    dataSource.setOptions({ logging: false });
    await dataSource.initialize();
    await dataSource.runMigrations();
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
};

/** Очищает только тестовую БД и ключи выделенного Redis-prefix, сохраняя schema и migrations. */
const clearE2eState = async () => {
  await Promise.all([truncatePostgresTables(), clearRedisPrefix()]);
};

const truncatePostgresTables = async () => {
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = Number(process.env.POSTGRES_PORT) || 5432;
  const client = new Client({
    host,
    port,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  });

  let connected = false;
  try {
    await client.connect();
    connected = true;
    await assertPostgresMigrations(client);
    const { rows } = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('migrations', 'typeorm_metadata')
    `);
    if (rows.length === 0) return;

    const tableNames = rows
      .map(({ table_name }) => `"${table_name.replaceAll('"', '""')}"`)
      .join(', ');
    await client.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
  } catch (error) {
    if (!connected) {
      throw new Error(
        `Bot E2E cannot connect to PostgreSQL at ${host}:${port}. Start the local PostgreSQL service and apply existing migrations to ${process.env.POSTGRES_DATABASE}.`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    if (connected) {
      await client.end();
    }
  }
};

/** Не запускает миграции: только предотвращает шумный bootstrap на пустой E2E БД. */
const assertPostgresMigrations = async (client: Client) => {
  const expectedMigrations = (
    await readdir(resolve(process.cwd(), 'src', 'migrations'))
  ).filter((fileName) => fileName.endsWith('.ts')).length;
  const { rows } = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'migrations'
  `);
  if (Number(rows[0]?.count) !== 1) {
    throw new Error(
      `Bot E2E database ${process.env.POSTGRES_DATABASE} has no migrations table. Apply existing migrations before running the suite.`,
    );
  }

  const migrationRows = await client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM migrations',
  );
  const appliedMigrations = Number(migrationRows.rows[0]?.count) || 0;
  if (appliedMigrations < expectedMigrations) {
    throw new Error(
      `Bot E2E database ${process.env.POSTGRES_DATABASE} has ${appliedMigrations}/${expectedMigrations} applied migrations. Apply existing migrations before running the suite.`,
    );
  }
};

const clearRedisPrefix = async () => {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT) || 6379;
  const redis = new Redis({
    host,
    port,
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DATABASE) || 0,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  const keyPattern = `${process.env.REDIS_PREFIX || ''}*`;

  try {
    await redis.connect();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        keyPattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.unlink(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    throw new Error(
      `Bot E2E cannot connect to Redis at ${host}:${port}, database ${process.env.REDIS_DATABASE || 0}.`,
      { cause: error },
    );
  } finally {
    redis.disconnect();
  }
};
