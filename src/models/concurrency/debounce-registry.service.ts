import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import { ConcurrencyKeyPart } from './concurrency.interface';

/** Локальный registry debounce-окон по ключу. */
@Injectable()
export class DebounceRegistryService implements OnApplicationShutdown {
  private static readonly DEFAULT_IDLE_TTL_MS = 5 * 60 * 1e3;

  private readonly idleTtlMs = DebounceRegistryService.DEFAULT_IDLE_TTL_MS;
  private readonly entries = new Map<string, number>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      Math.max(30 * 1e3, Math.floor(this.idleTtlMs / 2)),
    );
    this.cleanupInterval.unref?.();
  }

  onApplicationShutdown() {
    clearInterval(this.cleanupInterval);
    this.entries.clear();
  }

  public buildKey(scopes: ConcurrencyKeyPart[], key: ConcurrencyKeyPart) {
    return ['debounce', ...scopes, key]
      .filter((part) => part !== undefined && part !== null && part !== '')
      .map((part) => String(part).replaceAll(':', '_').replaceAll(' ', '_'))
      .join(':');
  }

  public check(key: string, windowMs: number, now = Date.now()) {
    this.cleanup(now);
    const lastTriggeredAt = this.entries.get(key);
    if (!lastTriggeredAt) return true;
    return now - lastTriggeredAt >= windowMs;
  }

  public mark(key: string, now = Date.now()) {
    this.entries.set(key, now);
  }

  public checkAndMark(key: string, windowMs: number, now = Date.now()) {
    if (!this.check(key, windowMs, now)) return false;
    this.mark(key, now);
    return true;
  }

  public clear(key: string) {
    this.entries.delete(key);
  }

  public cleanup(now = Date.now()) {
    const threshold = now - this.idleTtlMs;
    for (const [key, triggeredAt] of this.entries) {
      if (triggeredAt < threshold) this.entries.delete(key);
    }
  }
}
