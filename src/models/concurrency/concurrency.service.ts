import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

import {
  createLock,
  createRedlock,
  IoredisAdapter,
  type Lock,
  LockAcquisitionError,
  type LockHandle,
  type RedisAdapter,
} from 'redlock-universal';

import { LockBusyError } from '@my-common/exception';

import { RedisService } from '../redis/redis.service';

import {
  ConcurrencyKeyPart,
  ConcurrencyLease,
  DistributedExclusiveOptions,
  ExclusiveLocalOptions,
  QueueLocalOptions,
} from './concurrency.interface';
import { LocalKeyedMutexRegistry } from './local-keyed-mutex.registry';
import { LocalKeyedQueueRegistry } from './local-keyed-queue.registry';

@Injectable()
export class ConcurrencyService implements OnApplicationShutdown {
  private readonly logger = new Logger(ConcurrencyService.name);
  private readonly mutexRegistry = new LocalKeyedMutexRegistry();
  private readonly queueRegistry = new LocalKeyedQueueRegistry();
  private distributedAdapter?: RedisAdapter;

  constructor(private readonly redisService: RedisService) {}

  onApplicationShutdown() {
    this.mutexRegistry.destroy();
    this.queueRegistry.destroy();
  }

  public buildKey(scope: string, ...parts: ConcurrencyKeyPart[]) {
    return [scope, ...parts]
      .filter((part) => part !== undefined && part !== null && part !== '')
      .map((part) => String(part).replaceAll(':', '_').replaceAll(' ', '_'))
      .join(':');
  }

  public async exclusiveLocal<T>(
    key: string,
    callback: () => Promise<T>,
    options: ExclusiveLocalOptions = {},
  ) {
    return await this.mutexRegistry.runExclusive(key, callback, options);
  }

  public async tryExclusiveLocal<T>(
    key: string,
    callback: () => Promise<T>,
    options: ExclusiveLocalOptions = {},
  ) {
    return await this.mutexRegistry.tryRunExclusive(key, callback, options);
  }

  public async acquireExclusiveLocal(
    key: string,
    options: ExclusiveLocalOptions = {},
  ): Promise<ConcurrencyLease> {
    return await this.mutexRegistry.acquire(key, options);
  }

  public async queueLocal<T>(
    key: string,
    callback: () => Promise<T>,
    options: QueueLocalOptions = {},
  ) {
    return await this.queueRegistry.add(key, callback, options);
  }

  public async exclusiveDistributed<T>(
    key: string,
    callback: () => Promise<T>,
    options: DistributedExclusiveOptions = {},
  ) {
    const lock = this.createDistributedLock(key, options);
    let handle: LockHandle | null = null;

    try {
      handle = await lock.acquire();
      return await callback();
    } catch (err) {
      if (err instanceof LockAcquisitionError) {
        throw new LockBusyError(`Distributed lock is busy: ${key}`, key, err);
      }
      throw err;
    } finally {
      if (handle) {
        try {
          await lock.release(handle);
        } catch (err) {
          this.logger.warn(`Failed to release distributed lock: ${key}`);
          console.error(err);
        }
      }
    }
  }

  private createDistributedLock(
    key: string,
    options: DistributedExclusiveOptions,
  ): Lock {
    const ttl = options.ttlMs ?? 30e3;
    const retryAttempts = options.retryAttempts ?? 2;
    const retryDelay = options.retryDelayMs ?? 100;
    const adapters = [this.getDistributedAdapter()];
    if (adapters.length === 1) {
      return createLock({
        adapter: adapters[0],
        key,
        ttl,
        retryAttempts,
        retryDelay,
      });
    }
    return createRedlock({ adapters, key, ttl, retryAttempts, retryDelay });
  }

  private getDistributedAdapter() {
    if (!this.distributedAdapter) {
      this.distributedAdapter = IoredisAdapter.from(this.redisService.redis);
    }
    return this.distributedAdapter;
  }
}
