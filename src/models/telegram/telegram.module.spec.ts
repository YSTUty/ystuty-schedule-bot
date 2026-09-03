import { attachTelegramRedisSessionDiagnostics } from './telegram.module';

describe('Telegram Redis session diagnostics', () => {
  test('subscribes to Redis connection events and logs an error safely', () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const client = {
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
        return client;
      }),
    };
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };

    attachTelegramRedisSessionDiagnostics(client as never, 'session', logger);

    const error = new Error('read ETIMEDOUT');
    listeners.get('error')!(error);
    listeners.get('connect')!();
    listeners.get('ready')!();
    listeners.get('reconnecting')!();
    listeners.get('end')!();

    expect(logger.error).toHaveBeenCalledWith(
      '[Redis session] client error: read ETIMEDOUT',
      error.stack,
    );
    expect(logger.log).toHaveBeenCalledWith(
      '[Redis session] client connecting',
    );
    expect(logger.log).toHaveBeenCalledWith('[Redis session] client ready');
    expect(logger.warn).toHaveBeenCalledWith(
      '[Redis session] client reconnecting',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      '[Redis session] client disconnected',
    );
  });
});
