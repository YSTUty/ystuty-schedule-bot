import { CooldownError } from '@my-common/exception';

import { QueueLocalOptions } from './concurrency.interface';

type PQueueClass = typeof import('p-queue').default;
type QueueLike = {
  readonly size: number;
  readonly pending: number;
  add<T>(
    callback: () => Promise<T>,
    options?: { timeout?: number; throwOnTimeout?: boolean },
  ): Promise<T>;
};
type QueueEntry = { queue: QueueLike; lastUsedAt: number };

const importDynamic = new Function('specifier', 'return import(specifier)') as <
  T,
>(
  specifier: string,
) => Promise<T>;

class FallbackSerialQueue implements QueueLike {
  public size = 0;
  public pending = 0;
  private tail = Promise.resolve();

  public async add<T>(
    callback: () => Promise<T>,
    options?: { timeout?: number; throwOnTimeout?: boolean },
  ) {
    this.size++;
    const run = async () => {
      this.size--;
      this.pending++;
      try {
        const promise = callback();
        if (options?.timeout && options.timeout > 0) {
          let timeoutId: NodeJS.Timeout | undefined;
          return await Promise.race<T>([
            promise,
            new Promise<T>((_, reject) => {
              timeoutId = setTimeout(
                () => reject(new Error('Queue task timed out')),
                options.timeout,
              );
            }),
          ]).finally(() => timeoutId && clearTimeout(timeoutId));
        }
        return await promise;
      } finally {
        this.pending--;
      }
    };
    const result = this.tail.then(run, run);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }
}

/** Registry локальных FIFO-очередей по строковому ключу. */
export class LocalKeyedQueueRegistry {
  private readonly entries = new Map<string, QueueEntry>();
  private readonly entryPromises = new Map<string, Promise<QueueEntry>>();
  private queueCtorPromise?: Promise<PQueueClass | null>;
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
    this.entryPromises.clear();
  }

  public async add<T>(
    key: string,
    callback: () => Promise<T>,
    options: QueueLocalOptions = {},
  ) {
    const entry = await this.getEntry(key);
    if (
      options.maxQueueSize !== undefined &&
      entry.queue.size >= options.maxQueueSize
    ) {
      throw new CooldownError(`Queue is saturated: ${key}`, key);
    }

    entry.lastUsedAt = Date.now();
    try {
      return await entry.queue.add(
        async () => await callback(),
        options.timeoutMs
          ? { timeout: options.timeoutMs, throwOnTimeout: true }
          : undefined,
      );
    } finally {
      entry.lastUsedAt = Date.now();
      this.cleanupIdle();
    }
  }

  private async getEntry(key: string) {
    let entry = this.entries.get(key);
    if (!entry) {
      // Несколько одновременных первых update одного пользователя должны
      // получить одну очередь, а не создать независимые serial queues.
      let entryPromise = this.entryPromises.get(key);
      if (!entryPromise) {
        entryPromise = this.createEntry(key);
        this.entryPromises.set(key, entryPromise);
      }
      entry = await entryPromise;
    }
    this.cleanupIdle();
    return entry;
  }

  private async createEntry(key: string): Promise<QueueEntry> {
    try {
      const PQueue = await this.getQueueConstructor();
      const entry: QueueEntry = {
        queue: PQueue
          ? new PQueue({ concurrency: 1 })
          : new FallbackSerialQueue(),
        lastUsedAt: Date.now(),
      };
      this.entries.set(key, entry);
      return entry;
    } finally {
      this.entryPromises.delete(key);
    }
  }

  private async getQueueConstructor() {
    if (!this.queueCtorPromise) {
      this.queueCtorPromise = importDynamic<typeof import('p-queue')>('p-queue')
        .then((module) => module.default)
        .catch(() => {
          this.queueCtorPromise = undefined;
          return null;
        });
    }
    return await this.queueCtorPromise;
  }

  private cleanupIdle() {
    const threshold = Date.now() - this.idleTtlMs;
    for (const [key, entry] of this.entries) {
      if (
        entry.queue.size === 0 &&
        entry.queue.pending === 0 &&
        entry.lastUsedAt < threshold
      ) {
        this.entries.delete(key);
      }
    }
  }
}
