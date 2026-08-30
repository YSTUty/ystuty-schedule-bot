import { delay } from './other.util';

const TRANSIENT_REDIS_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
]);

const DEFAULT_RETRY_DELAY_MS = 1e3;

type SessionMiddleware<TContext> = (
  ctx: TContext,
  next: (...args: any[]) => any,
) => any;

type RedisSessionRetryOptions = {
  onRetry?: (error: Error) => void;
  retryDelayMs?: number;
};

/** Возвращает true только для временных ошибок соединения Redis session-клиента. */
export const isTransientRedisSessionError = (
  error: unknown,
): error is Error => {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  if (code && TRANSIENT_REDIS_ERROR_CODES.has(code)) {
    return true;
  }

  return (
    error.name === 'AbortError' &&
    code === 'UNCERTAIN_STATE' &&
    error.message ===
      'Redis connection lost and command aborted. It might have been processed.'
  );
};

/**
 * Повторяет загрузку session один раз до запуска следующего middleware.
 * Ошибки после вызова next не повторяются, чтобы не выполнить handler дважды.
 */
export const withRedisSessionLoadRetry = <
  TContext,
  TMiddleware extends SessionMiddleware<TContext> = SessionMiddleware<TContext>,
>(
  middleware: TMiddleware,
  options: RedisSessionRetryOptions = {},
): TMiddleware => {
  const { onRetry, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options;

  const retryMiddleware = async (
    ctx: TContext,
    next: (...args: any[]) => any,
  ) => {
    let nextStarted = false;
    const guardedNext = async (...args: any[]) => {
      nextStarted = true;
      await next(...args);
    };

    try {
      await middleware(ctx, guardedNext);
    } catch (error) {
      if (nextStarted || !isTransientRedisSessionError(error)) {
        throw error;
      }

      onRetry?.(error);
      await delay(retryDelayMs);

      await middleware(ctx, guardedNext);
    }
  };

  return retryMiddleware as TMiddleware;
};
