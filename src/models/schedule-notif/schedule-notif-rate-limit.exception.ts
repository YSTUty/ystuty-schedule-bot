/** Ошибка для Bull custom backoff с задержкой, запрошенной транспортом. */
export class ScheduleNotifRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    message: string,
  ) {
    super(message);
    this.name = ScheduleNotifRateLimitError.name;
  }
}
