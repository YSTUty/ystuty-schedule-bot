import { TG_ALLOWED_CHAT_TYPES_KEY } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';

import { UnhandledPrivateMessageUpdate } from './unhandled-private-message.update';

describe('UnhandledPrivateMessageUpdate', () => {
  const update = new UnhandledPrivateMessageUpdate({} as any);

  it('replies to an unhandled private Telegram text with the start keyboard', async () => {
    const keyboard = { reply_markup: { keyboard: [] } };
    (update as any).keyboardFactory.getStart = jest
      .fn()
      .mockReturnValue(keyboard);
    const ctx = {
      i18n: { t: jest.fn().mockReturnValue('Не понял сообщение.') },
      replyWithHTML: jest.fn(),
    } as any;

    await update.onUnhandledPrivateMessage(ctx);

    expect((update as any).keyboardFactory.getStart).toHaveBeenCalledWith(ctx);
    expect(ctx.i18n.t).toHaveBeenCalledWith(LocalePhrase.Page_UnknownMessage);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'Не понял сообщение.',
      keyboard,
    );
  });

  it('registers the fallback only for private text messages', () => {
    expect(
      Reflect.getMetadata(
        'LISTENERS_METADATA',
        UnhandledPrivateMessageUpdate.prototype.onUnhandledPrivateMessage,
      ),
    ).toEqual([expect.objectContaining({ args: ['text'] })]);
    expect(
      Reflect.getMetadata(
        TG_ALLOWED_CHAT_TYPES_KEY,
        UnhandledPrivateMessageUpdate.prototype.onUnhandledPrivateMessage,
      ),
    ).toEqual(['private']);
  });
});
