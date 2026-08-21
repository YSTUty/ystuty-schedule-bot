import { MainMiddleware } from './main.middleware';

describe('VK MainMiddleware message subscription', () => {
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
          exclusiveLocal: jest.fn(async (_key, callback) => callback()),
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
});
