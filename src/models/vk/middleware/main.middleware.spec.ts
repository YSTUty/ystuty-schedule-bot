import { CooldownError, LockBusyError } from '@my-common/exception';

import { MainMiddleware } from './main.middleware';

describe('VK MainMiddleware message subscription', () => {
  const createFeatureMiddleware = (error: Error) => {
    const middleware = Object.create(
      MainMiddleware.prototype,
    ) as MainMiddleware;
    Object.defineProperty(middleware, 'concurrencyService', {
      value: {
        buildKey: jest.fn().mockReturnValue('mw:update:vk:123'),
        queueLocal: jest.fn().mockRejectedValue(error),
      },
    });
    Object.defineProperty(middleware, 'debounceRegistryService', {
      value: {
        buildKey: jest.fn().mockReturnValue('vk:request-error:123'),
        checkAndMark: jest.fn().mockReturnValue(true),
      },
    });
    Object.defineProperty(middleware, 'logger', {
      value: { warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
    });
    return middleware;
  };

  it('answers a message event only once', async () => {
    const middleware = Object.create(
      MainMiddleware.prototype,
    ) as MainMiddleware;
    Object.defineProperty(middleware, 'concurrencyService', {
      value: {
        buildKey: jest.fn().mockReturnValue('mw:update:vk:123'),
        queueLocal: jest.fn(async (_key, callback) => callback()),
      },
    });
    const originalAnswer = jest.fn().mockResolvedValue(1);
    const ctx = {
      isOutbox: false,
      type: 'message_event',
      peerId: 123,
      state: {},
      answer: originalAnswer,
      is: jest.fn((types: string[]) => types.includes('message_event')),
      toJSON: jest.fn().mockReturnValue({}),
    };

    await middleware['featureMiddleware'](ctx as never, async () => {
      await ctx.answer({ type: 'show_snackbar', text: 'Первый ответ' });
      await ctx.answer({ type: 'show_snackbar', text: 'Повторный ответ' });
    });

    expect(originalAnswer).toHaveBeenCalledTimes(1);
    expect(originalAnswer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'Первый ответ',
    });
    expect(ctx.state).toEqual({ eventAnswered: true });
  });

  it.each([
    ['message_allow', true, false],
    ['message_deny', false, true],
  ])(
    'marks %s as a direct-message context',
    async (_subtype, isSubscribed, isUnsubscribed) => {
      const middleware = Object.create(
        MainMiddleware.prototype,
      ) as MainMiddleware;
      Object.defineProperty(middleware, 'concurrencyService', {
        value: {
          buildKey: jest.fn().mockReturnValue('mw:update:vk:183464245'),
          queueLocal: jest.fn(async (_key, callback) => callback()),
        },
      });
      const ctx: {
        isOutbox: boolean;
        type: string;
        userId: number;
        peerId?: number;
        isDM?: boolean;
        isSubscribed: boolean;
        isUnsubscribed: boolean;
        state: Record<string, never>;
        is: jest.Mock;
        toJSON: jest.Mock;
      } = {
        isOutbox: false,
        type: 'message_subscription',
        userId: 183_464_245,
        isSubscribed,
        isUnsubscribed,
        state: {},
        is: jest.fn().mockReturnValue(false),
        toJSON: jest.fn().mockReturnValue({}),
      };

      await middleware['featureMiddleware'](ctx as never, async () => {
        expect(ctx.peerId).toBe(ctx.userId);
        expect(ctx.isDM).toBe(true);
      });
    },
  );

  it('does not assign a peer to another VK update', async () => {
    const middleware = Object.create(
      MainMiddleware.prototype,
    ) as MainMiddleware;
    const logger = { warn: jest.fn(), debug: jest.fn() };
    Object.defineProperty(middleware, 'logger', { value: logger });
    const ctx = {
      isOutbox: false,
      type: 'message',
      peerId: undefined as number | undefined,
      state: {},
      is: jest.fn().mockReturnValue(false),
      toJSON: jest.fn().mockReturnValue({}),
    };

    await middleware['featureMiddleware'](ctx as never, jest.fn());

    expect(ctx.peerId).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      '[VK] Empty ctx.peerId from ctx type(message)',
    );
  });

  it('creates a profile for message_allow when VK profile lookup fails', async () => {
    const middleware = Object.create(
      MainMiddleware.prototype,
    ) as MainMiddleware;
    const userSocial = { hasDM: true, user: null, isBlockedBot: false };
    const userService = {
      findBySocialId: jest.fn().mockResolvedValue(null),
      createUserSocial: jest.fn().mockResolvedValue(userSocial),
      saveUserSocial: jest.fn().mockResolvedValue(userSocial),
    };
    const logger = { warn: jest.fn() };
    Object.defineProperty(middleware, 'userService', { value: userService });
    Object.defineProperty(middleware, 'logger', { value: logger });

    const ctx = {
      peerId: 183_464_245,
      userId: 183_464_245,
      isDM: true,
      isChat: false,
      state: {},
      is: jest.fn().mockReturnValue(false),
      isMessageSubscriptionContext: jest.fn().mockReturnValue(true),
      isSubscribed: true,
      isUnsubscribed: false,
      api: { users: { get: jest.fn().mockRejectedValue(new Error('VK API')) } },
    };

    await middleware['userMiddleware'](ctx as never, jest.fn());

    expect(userService.createUserSocial).toHaveBeenCalledWith(
      expect.anything(),
      { socialId: ctx.userId, hasDM: true },
    );
    expect(userService.saveUserSocial).toHaveBeenCalledWith(userSocial);
    expect(logger.warn).toHaveBeenCalledWith(
      '[VK][users.get] Cannot load user profile',
      expect.stringContaining('VK API'),
    );
  });

  it('reports queue saturation with a translated fallback before i18n middleware', async () => {
    const middleware = createFeatureMiddleware(
      new CooldownError(
        'Queue is saturated: mw:update:vk:123',
        'mw:update:vk:123',
      ),
    );
    const reply = jest.fn().mockResolvedValue({});
    const ctx = {
      isOutbox: false,
      type: 'message',
      peerId: 123,
      state: {},
      is: jest.fn().mockReturnValue(false),
      toJSON: jest.fn().mockReturnValue({}),
      reply,
    };

    await middleware['featureMiddleware'](ctx as never, jest.fn());

    expect(reply).toHaveBeenCalledWith(
      '⚠️ Слишком много запросов подряд. Подождите немного и повторите.',
    );
    expect((middleware as any).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('CooldownError; key=mw:update:vk:123'),
    );
  });

  it('reports an occupied resource separately from queue saturation', async () => {
    const middleware = createFeatureMiddleware(
      new LockBusyError('Distributed lock is busy', 'schedule:request'),
    );
    const reply = jest.fn().mockResolvedValue({});
    const ctx = {
      isOutbox: false,
      type: 'message',
      peerId: 123,
      state: {},
      is: jest.fn().mockReturnValue(false),
      toJSON: jest.fn().mockReturnValue({}),
      reply,
    };

    await middleware['featureMiddleware'](ctx as never, jest.fn());

    expect(reply).toHaveBeenCalledWith(
      '⏳ Запрос уже обрабатывается. Подождите немного.',
    );
  });
});
