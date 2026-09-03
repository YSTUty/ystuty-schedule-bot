import * as xEnv from '@my-environment';

import {
  DEFAULT_TELEGRAM_BROADCAST_MAX_DELIVERIES_PER_SECOND,
  DEFAULT_TELEGRAM_BROADCAST_MAX_RETRY_ATTEMPTS,
  DEFAULT_TELEGRAM_BROADCAST_RATE_LIMIT_BUFFER_SECONDS,
} from './broadcast.constants';

/** Возвращает лимит истории только при явном включении автоочистки. */
export function getBroadcastHistoryLimit(): number | null {
  const raw = xEnv.BROADCAST_HISTORY_LIMIT;
  if (!raw) return null;
  if (raw === 'false' || raw === 'off' || raw === '0') return null;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Безопасный лимит recipients/s: forward с клавиатурой может стоить два API-вызова. */
export function getTelegramBroadcastMaxDeliveriesPerSecond() {
  return getPositiveInteger(
    xEnv.TELEGRAM_BROADCAST_MAX_DELIVERIES_PER_SECOND,
    DEFAULT_TELEGRAM_BROADCAST_MAX_DELIVERIES_PER_SECOND,
    1,
    25,
  );
}

/** Добавочный запас к retry_after, чтобы не отправить новую пачку раньше Telegram. */
export function getTelegramBroadcastRateLimitBufferMs() {
  return (
    getPositiveInteger(
      xEnv.TELEGRAM_BROADCAST_RATE_LIMIT_BUFFER_SECONDS,
      DEFAULT_TELEGRAM_BROADCAST_RATE_LIMIT_BUFFER_SECONDS,
      1,
      60,
    ) * 1e3
  );
}

export function getTelegramBroadcastMaxRetryAttempts() {
  return getPositiveInteger(
    xEnv.TELEGRAM_BROADCAST_MAX_RETRY_ATTEMPTS,
    DEFAULT_TELEGRAM_BROADCAST_MAX_RETRY_ATTEMPTS,
    1,
    100,
  );
}

function getPositiveInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (!Number.isFinite(value) || value == null) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
