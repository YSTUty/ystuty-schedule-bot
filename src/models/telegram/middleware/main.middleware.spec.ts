import { TelegramError } from 'telegraf-hardened';

import { CooldownError, LockBusyError } from '@my-common/exception';

import { MainMiddleware } from './main.middleware';

describe('Telegram MainMiddleware', () => {
  const createMiddleware = (queueLocal?: jest.Mock) => {
    const middleware = new MainMiddleware(
      {
        buildKey: jest.fn().mockReturnValue('mw:update:tg:1'),
        queueLocal:
          queueLocal ?? jest.fn(async (_key, callback) => await callback()),
      } as never,
      {
        buildKey: jest.fn().mockReturnValue('tg:request-error:1'),
        checkAndMark: jest.fn().mockReturnValue(true),
      } as never,
    );
    return middleware;
  };

  const flushAsyncWork = async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  };

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

  it('uses the hardened draft API for streaming messages', async () => {
    const middleware = createMiddleware();
    const sendMessageDraft = jest.fn().mockResolvedValue(true);
    const ctx = {
      from: { id: 1, is_bot: false },
      chat: { id: 123 },
      updateType: 'message',
      update: { message: {} },
      state: {},
      telegram: { sendMessageDraft },
      assert: jest.fn(),
    };

    await middleware.middleware()(ctx as never, async () => {
      await (ctx as any).sendMessageDraft(42, 'Черновик', {
        parse_mode: 'HTML',
      });
    });

    expect(sendMessageDraft).toHaveBeenCalledWith({
      chat_id: 123,
      draft_id: 42,
      text: 'Черновик',
      parse_mode: 'HTML',
    });
  });

  it('reports queue saturation with a translated fallback before i18n middleware', async () => {
    const queueLocal = jest
      .fn()
      .mockRejectedValue(
        new CooldownError(
          'Queue is saturated: mw:update:tg:1',
          'mw:update:tg:1',
        ),
      );
    const middleware = createMiddleware(queueLocal);
    const logger = { warn: jest.fn(), error: jest.fn() };
    Object.defineProperty(middleware, 'logger', { value: logger });
    const replyWithHTML = jest.fn().mockResolvedValue({});
    const ctx = {
      from: { id: 1, is_bot: false },
      updateType: 'message',
      update: {},
      state: {},
      replyWithHTML,
    };

    await middleware.middleware()(ctx as never, jest.fn());
    await flushAsyncWork();

    expect(queueLocal).toHaveBeenCalledWith(
      'mw:update:tg:1',
      expect.any(Function),
      { maxQueueSize: 3 },
    );
    expect(replyWithHTML).toHaveBeenCalledWith(
      '⚠️ Слишком много запросов подряд. Подождите немного и повторите.',
      {},
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('CooldownError; key=mw:update:tg:1'),
    );
  });

  it('reports an occupied resource separately from queue saturation', async () => {
    const middleware = createMiddleware(
      jest
        .fn()
        .mockRejectedValue(
          new LockBusyError('Distributed lock is busy', 'schedule:request'),
        ),
    );
    const replyWithHTML = jest.fn().mockResolvedValue({});
    const ctx = {
      from: { id: 1, is_bot: false },
      updateType: 'message',
      update: {},
      state: {},
      replyWithHTML,
    };

    await middleware.middleware()(ctx as never, jest.fn());
    await flushAsyncWork();

    expect(replyWithHTML).toHaveBeenCalledWith(
      '⏳ Запрос уже обрабатывается. Подождите немного.',
      {},
    );
  });
});
