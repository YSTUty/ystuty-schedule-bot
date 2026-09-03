import { LocalePhrase } from '@my-interfaces';

import { UnhandledPrivateMessageMiddleware } from './unhandled-private-message.middleware';

describe('UnhandledPrivateMessageMiddleware', () => {
  const createMiddleware = () => {
    const keyboardFactory = { getUnknownMessageHelp: jest.fn() };
    const middleware = new UnhandledPrivateMessageMiddleware(
      keyboardFactory as any,
    );

    return { middleware, keyboardFactory };
  };

  it('replies to unhandled private texts with an inline help button', async () => {
    const { middleware, keyboardFactory } = createMiddleware();
    const keyboard = { reply_markup: { keyboard: [] } };
    keyboardFactory.getUnknownMessageHelp.mockReturnValue(keyboard);
    const ctx = {
      chat: { type: 'private' },
      i18n: { t: jest.fn().mockReturnValue('Не понял сообщение.') },
      replyWithHTML: jest.fn(),
    };

    await middleware.onUnhandledPrivateMessage(ctx as any);

    expect(keyboardFactory.getUnknownMessageHelp).toHaveBeenCalledWith(ctx);
    expect(ctx.i18n.t).toHaveBeenCalledWith(LocalePhrase.Page_UnknownMessage);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'Не понял сообщение.',
      keyboard,
    );
  });
});
