import {
  isTransientRedisSessionError,
  withRedisSessionLoadRetry,
} from './redis-session-retry.util';

type TestContext = Record<string, never>;

const createAbortedRedisCommandError = () => {
  const error = new Error(
    'Redis connection lost and command aborted. It might have been processed.',
  );
  error.name = 'AbortError';
  (error as NodeJS.ErrnoException).code = 'UNCERTAIN_STATE';
  return error;
};

describe('withRedisSessionLoadRetry', () => {
  it('retries a transient Redis error before the handler starts', async () => {
    const redisError = createAbortedRedisCommandError();
    const onRetry = jest.fn();
    const next = jest.fn().mockResolvedValue(undefined);
    const middleware = jest
      .fn()
      .mockRejectedValueOnce(redisError)
      .mockImplementationOnce(async (_ctx, middlewareNext) => {
        await middlewareNext();
      });

    await withRedisSessionLoadRetry<TestContext>(middleware, {
      onRetry,
      retryDelayMs: 0,
    })({}, next);

    expect(middleware).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(redisError);
  });

  it('does not retry when the handler has already started', async () => {
    const redisError = createAbortedRedisCommandError();
    const next = jest.fn().mockResolvedValue(undefined);
    const middleware = jest.fn(async (_ctx, middlewareNext) => {
      await middlewareNext();
      throw redisError;
    });

    await expect(
      withRedisSessionLoadRetry<TestContext>(middleware, {
        retryDelayMs: 0,
      })({}, next),
    ).rejects.toBe(redisError);

    expect(middleware).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-network Redis error', async () => {
    const error = new Error(
      'WRONGTYPE Operation against a key holding the wrong kind of value',
    );
    const middleware = jest.fn().mockRejectedValue(error);

    await expect(
      withRedisSessionLoadRetry<TestContext>(middleware, {
        retryDelayMs: 0,
      })({}, jest.fn()),
    ).rejects.toBe(error);

    expect(middleware).toHaveBeenCalledTimes(1);
    expect(isTransientRedisSessionError(error)).toBe(false);
  });

  it('recognizes a Redis network timeout as transient', () => {
    const error = new Error('Redis connection timed out');
    (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';

    expect(isTransientRedisSessionError(error)).toBe(true);
  });
});
