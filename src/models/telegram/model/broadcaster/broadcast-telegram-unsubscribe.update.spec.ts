import { LocalePhrase } from '@my-interfaces';

import { BroadcastTelegramUnsubscribeUpdate } from './broadcast-telegram-unsubscribe.update';

describe('BroadcastTelegramUnsubscribeUpdate', () => {
  it('shows a confirmation screen in a private chat', async () => {
    const keyboard = { inline_keyboard: [] };
    const update = new BroadcastTelegramUnsubscribeUpdate(
      {} as any,
      {
        getBroadcastUnsubscribeConfirmation: jest
          .fn()
          .mockReturnValue(keyboard),
      } as any,
    );
    const ctx = {
      chat: { type: 'private' },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
    };

    await update.onUnsubscribeCommand(ctx as any);

    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      LocalePhrase.Page_Broadcast_UnsubscribeConfirm,
      keyboard,
    );
  });

  it('persists the disabled timestamp only after confirmation', async () => {
    const userService = { disableBroadcasts: jest.fn() };
    const update = new BroadcastTelegramUnsubscribeUpdate(
      userService as any,
      {} as any,
    );
    const ctx = {
      chat: { type: 'private' },
      userSocial: { id: 8 },
      i18n: { t: jest.fn((phrase) => phrase) },
      tryAnswerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
    };

    await update.onConfirm(ctx as any);

    expect(userService.disableBroadcasts).toHaveBeenCalledWith(ctx.userSocial);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      LocalePhrase.Broadcast_Notification_Unsubscribed,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      },
    );
  });

  it('deletes the confirmation message after cancellation', async () => {
    const update = new BroadcastTelegramUnsubscribeUpdate({} as any, {} as any);
    const ctx = {
      i18n: { t: jest.fn((phrase) => phrase) },
      tryAnswerCbQuery: jest.fn(),
      deleteMessage: jest.fn(),
    };

    await update.onCancel(ctx as any);

    expect(ctx.deleteMessage).toHaveBeenCalledTimes(1);
  });
});
