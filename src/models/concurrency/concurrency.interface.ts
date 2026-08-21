/** Допустимый тип части concurrency key. */
export type ConcurrencyKeyPart = string | number | boolean | null | undefined;

/** Настройки локального mutex. */
export interface ExclusiveLocalOptions {
  /** Максимальное время ожидания захвата локального mutex в миллисекундах. */
  timeoutMs?: number;
}

/** Настройки локальной очереди по ключу. */
export interface QueueLocalOptions {
  /** Максимальное время выполнения одной queued-задачи в миллисекундах. */
  timeoutMs?: number;

  /** Максимально допустимое количество ожидающих задач в очереди по ключу. */
  maxQueueSize?: number;
}

/** Настройки distributed lock. */
export interface DistributedExclusiveOptions {
  /** TTL distributed lock в миллисекундах. */
  ttlMs?: number;

  /** Количество повторных попыток захвата distributed lock. */
  retryAttempts?: number;

  /** Задержка между повторными попытками захвата distributed lock в миллисекундах. */
  retryDelayMs?: number;
}

/** Lease для ручного владения локальным mutex. */
export interface ConcurrencyLease {
  /** Явно освобождает ранее захваченный локальный mutex. */
  release(): Promise<void>;
}
