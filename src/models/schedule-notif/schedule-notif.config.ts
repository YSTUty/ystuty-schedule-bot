import { ScheduleNotifRateLimitError } from './schedule-notif-rate-limit.exception';
import {
  SCHEDULE_NOTIF_RETRY_BASE_DELAY_MS,
  SCHEDULE_NOTIF_RETRY_MAX_DELAY_MS,
} from './schedule-notif.constants';

/** Вычисляет задержку Bull: точный retry_after важнее общего экспоненциального backoff. */
export function getScheduleNotifRetryBackoffMs(
  attemptsMade: number,
  error: Error,
) {
  if (error instanceof ScheduleNotifRateLimitError) {
    return error.retryAfterMs;
  }

  return Math.min(
    SCHEDULE_NOTIF_RETRY_MAX_DELAY_MS,
    SCHEDULE_NOTIF_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptsMade - 1),
  );
}
