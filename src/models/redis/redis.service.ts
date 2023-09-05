import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import * as Redlock from 'redlock';
import {
  REDIS_DATABASE,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_PREFIX,
  REDIS_USER,
} from '@my-environment';

@Injectable()
export class RedisService {
  public readonly redis: Redis.Redis;
  public readonly redlock: Redlock;

  constructor() {
    this.redis = new Redis(REDIS_PORT, REDIS_HOST, {
      db: REDIS_DATABASE,
      username: REDIS_USER,
      password: REDIS_PASSWORD,
      keyPrefix: REDIS_PREFIX,
    });

    this.redlock = new Redlock([this.redis]);
  }
}
