/** Ошибка для Bull custom backoff с точной задержкой Telegram retry_after. */
export class BroadcastRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    message: string,
  ) {
    super(message);
    this.name = BroadcastRateLimitError.name;
  }
}
