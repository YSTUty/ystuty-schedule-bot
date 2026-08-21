import { TelegramError } from 'telegraf';

import { MainMiddleware } from './main.middleware';

describe('Telegram MainMiddleware', () => {
  const createMiddleware = () =>
    new MainMiddleware(
      {
        buildKey: jest.fn().mockReturnValue('mw:update:tg:1'),
        exclusiveLocal: jest.fn(async (_key, callback) => callback()),
      } as never,
      {} as never,
    );

  it('ignores an expired callback query acknowledgement', async () => {
    const middleware = createMiddleware();
    const ctx = {
      from: { id: 1, is_bot: false },
      updateType: 'callback_query',
      answerCbQuery: jest.fn().mockRejectedValue(
        new TelegramError({
          error_code: 400,
          description:
            'Bad Request: query is too old and response timeout expired or query ID is invalid',
        }),
      ),
      state: {},
      update: {},
    };

    await middleware.middleware()(ctx as never, async () => {
      await expect((ctx as any).tryAnswerCbQuery()).resolves.toBeNull();
    });
  });

  it('rethrows another callback acknowledgement error', async () => {
    const middleware = createMiddleware();
    const error = new TelegramError({
      error_code: 400,
      description: 'Bad Request: query ID is invalid',
    });
    const ctx = {
      from: { id: 1, is_bot: false },
      updateType: 'callback_query',
      answerCbQuery: jest.fn().mockRejectedValue(error),
      state: {},
      update: {},
    };

    await middleware.middleware()(ctx as never, async () => {
      await expect((ctx as any).tryAnswerCbQuery()).rejects.toBe(error);
    });
  });
});
