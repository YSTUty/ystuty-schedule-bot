import { LocalePhrase } from '@my-interfaces';

import { UnhandledPrivateMessageMiddleware } from './unhandled-private-message.middleware';

describe('UnhandledPrivateMessageMiddleware', () => {
  const createMiddleware = () => {
    const bot = { on: jest.fn() };
    const keyboardFactory = { getStart: jest.fn() };
    const middleware = new UnhandledPrivateMessageMiddleware(
      bot as any,
      keyboardFactory as any,
    );

    middleware.onApplicationBootstrap();
    return { bot, keyboardFactory };
  };

  it('registers a fallback after application bootstrap', () => {
    const { bot } = createMiddleware();

    expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
  });

  it('replies to unhandled private texts with the start keyboard', async () => {
    const { bot, keyboardFactory } = createMiddleware();
    const fallback = bot.on.mock.calls[0][1];
    const keyboard = { reply_markup: { keyboard: [] } };
    keyboardFactory.getStart.mockReturnValue(keyboard);
    const ctx = {
      chat: { type: 'private' },
      i18n: { t: jest.fn().mockReturnValue('Не понял сообщение.') },
      replyWithHTML: jest.fn(),
    };

    await fallback(ctx);

    expect(keyboardFactory.getStart).toHaveBeenCalledWith(ctx);
    expect(ctx.i18n.t).toHaveBeenCalledWith(LocalePhrase.Page_UnknownMessage);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'Не понял сообщение.',
      keyboard,
    );
  });

  it('does not answer messages outside private chats', async () => {
    const { bot, keyboardFactory } = createMiddleware();
    const fallback = bot.on.mock.calls[0][1];
    const ctx = {
      chat: { type: 'group' },
      replyWithHTML: jest.fn(),
    };

    await fallback(ctx);

    expect(keyboardFactory.getStart).not.toHaveBeenCalled();
    expect(ctx.replyWithHTML).not.toHaveBeenCalled();
  });
});
