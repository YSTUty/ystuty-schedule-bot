import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import * as Redlock from 'redlock';
import { Redis } from 'ioredis';

import * as xEnv from '@my-environment';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private isShuttingDown = false;

  public readonly redis: Redis;
  public readonly redlock: Redlock;

  constructor() {
    this.redis = new Redis(xEnv.REDIS_PORT, xEnv.REDIS_HOST, {
      db: xEnv.REDIS_DATABASE,
      username: xEnv.REDIS_USER,
      password: xEnv.REDIS_PASSWORD,
      keyPrefix: xEnv.REDIS_PREFIX,
    });

    this.redis.on('error', (error) => {
      if (this.isShuttingDown) return;
      this.logger.error(`Redis error: ${error.message}`, error.stack);
    });
    this.redis.on('connect', () => {
      this.logger.log(`Redis → connected`);
    });
    this.redis.on('reconnecting', (delay: number) => {
      this.logger.warn(
        `Redis reconnecting in ${delay} ms (attempt ${this.redis.status})`,
      );
    });

    this.redlock = new Redlock([this.redis as any]);
    this.redlock.on('clientError', (error) => {
      this.logger.error(`Redlock error: ${error.message}`, error.stack);
    });
  }

  /** Закрывает основной ioredis-клиент, когда Nest останавливает приложение. */
  public async onModuleDestroy() {
    if (this.redis.status === 'end') return;
    this.isShuttingDown = true;

    try {
      await this.redis.quit();
    } catch (error) {
      // При недоступном Redis graceful QUIT может не завершиться; socket всё
      // равно надо закрыть, чтобы shutdown приложения не зависал.
      this.redis.disconnect();
      this.logger.debug(
        `Redis disconnect after failed quit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
