import { Injectable, OnModuleDestroy } from '@nestjs/common';

import type { RedisClient } from 'redis';

type LegacyRedisClient = Pick<RedisClient, 'end'>;

const sessionClients = new Set<LegacyRedisClient>();

/** Регистрирует legacy Redis-клиент, созданный пакетом telegraf-session-redis. */
export const registerTelegramSessionRedisClient = (
  client: LegacyRedisClient,
) => {
  sessionClients.add(client);
};

/**
 * telegraf-session-redis не интегрирован с Nest lifecycle и не закрывает
 * созданные самостоятельно node_redis-клиенты. Без этого E2E и graceful
 * shutdown оставляют открытые TCP-сокеты Redis.
 */
@Injectable()
export class TelegramRedisSessionLifecycleService implements OnModuleDestroy {
  public onModuleDestroy() {
    for (const client of sessionClients) {
      client.end(true);
    }
    sessionClients.clear();
  }
}
