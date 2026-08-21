import {
  E_ALREADY_LOCKED,
  E_TIMEOUT,
  Mutex,
  tryAcquire,
  withTimeout,
} from 'async-mutex';

import { LockBusyError } from '@my-common/exception';

import {
  ConcurrencyLease,
  ExclusiveLocalOptions,
} from './concurrency.interface';

type MutexEntry = {
  mutex: Mutex;
  lastUsedAt: number;
};

/** Registry локальных mutex по строковому ключу. */
export class LocalKeyedMutexRegistry {
  private readonly entries = new Map<string, MutexEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly idleTtlMs = 5 * 60 * 1e3) {
    this.cleanupInterval = setInterval(
      () => this.cleanupIdle(),
      Math.max(30 * 1e3, Math.floor(this.idleTtlMs / 2)),
    );
    this.cleanupInterval.unref?.();
  }

  public destroy() {
    clearInterval(this.cleanupInterval);
    this.entries.clear();
  }

  public async runExclusive<T>(
    key: string,
    callback: () => Promise<T>,
    options: ExclusiveLocalOptions = {},
  ) {
    const entry = this.touch(key);

    try {
      const mutex = this.wrapMutex(entry.mutex, key, options, false);
      return await mutex.runExclusive(callback);
    } catch (err) {
      throw this.normalizeError(err, key);
    } finally {
      entry.lastUsedAt = Date.now();
      this.cleanupIdle();
    }
  }

  public async tryRunExclusive<T>(
    key: string,
    callback: () => Promise<T>,
    options: ExclusiveLocalOptions = {},
  ) {
    const entry = this.touch(key);

    try {
      const mutex = this.wrapMutex(entry.mutex, key, options, true);
      return await mutex.runExclusive(callback);
    } catch (err) {
      throw this.normalizeError(err, key);
    } finally {
      entry.lastUsedAt = Date.now();
      this.cleanupIdle();
    }
  }

  public async acquire(
    key: string,
    options: ExclusiveLocalOptions = {},
  ): Promise<ConcurrencyLease> {
    const entry = this.touch(key);

    try {
      const mutex = this.wrapMutex(entry.mutex, key, options, false);
      const release = await mutex.acquire();
      let isReleased = false;

      return {
        release: async () => {
          if (!isReleased) {
            isReleased = true;
            release();
            entry.lastUsedAt = Date.now();
            this.cleanupIdle();
          }
        },
      };
    } catch (err) {
      throw this.normalizeError(err, key);
    }
  }

  private touch(key: string) {
    const now = Date.now();
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { mutex: new Mutex(), lastUsedAt: now };
      this.entries.set(key, entry);
    } else {
      entry.lastUsedAt = now;
    }

    this.cleanupIdle();
    return entry;
  }

  private wrapMutex(
    mutex: Mutex,
    key: string,
    options: ExclusiveLocalOptions,
    failFast: boolean,
  ) {
    if (failFast) {
      return tryAcquire(
        mutex,
        new LockBusyError(`Local lock is busy: ${key}`, key),
      );
    }

    if (options.timeoutMs && options.timeoutMs > 0) {
      return withTimeout(
        mutex,
        options.timeoutMs,
        new LockBusyError(`Timed out waiting for local lock: ${key}`, key),
      );
    }

    return mutex;
  }

  private normalizeError(error: unknown, key: string) {
    if (error instanceof LockBusyError) return error;
    if (error === E_ALREADY_LOCKED || error === E_TIMEOUT) {
      return new LockBusyError(`Local lock is busy: ${key}`, key, error);
    }

    return error;
  }

  private cleanupIdle() {
    const threshold = Date.now() - this.idleTtlMs;
    for (const [key, entry] of this.entries) {
      if (!entry.mutex.isLocked() && entry.lastUsedAt < threshold) {
        this.entries.delete(key);
      }
    }
  }
}
