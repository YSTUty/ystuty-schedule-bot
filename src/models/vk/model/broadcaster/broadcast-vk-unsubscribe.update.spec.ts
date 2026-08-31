import { LocalePhrase } from '@my-interfaces';

import { BroadcastVkUnsubscribeUpdate } from './broadcast-vk-unsubscribe.update';

describe('BroadcastVkUnsubscribeUpdate', () => {
  it('shows a new inline confirmation message in direct messages', async () => {
    const update = new BroadcastVkUnsubscribeUpdate(
      {} as any,
      {
        getBroadcastUnsubscribeConfirmation: jest.fn().mockReturnValue({
          inline: jest.fn().mockReturnValue('keyboard'),
        }),
      } as any,
    );
    const ctx = {
      isDM: true,
      i18n: { t: jest.fn((phrase) => phrase) },
      send: jest.fn(),
    };

    await update.onUnsubscribeCommand(ctx as any);

    expect(ctx.send).toHaveBeenCalledWith(
      LocalePhrase.Page_Broadcast_UnsubscribeConfirm,
      { keyboard: 'keyboard' },
    );
  });

  it('disables broadcasts after a confirmed VK callback', async () => {
    const userService = { disableBroadcasts: jest.fn() };
    const update = new BroadcastVkUnsubscribeUpdate(
      userService as any,
      {} as any,
    );
    const ctx = {
      isDM: true,
      eventPayload: { broadcastUnsubscribe: 'confirm' },
      state: { userSocial: { id: 11 } },
      peerId: 22,
      conversationMessageId: 33,
      i18n: { t: jest.fn((phrase) => phrase) },
      answer: jest.fn(),
      api: { messages: { edit: jest.fn() } },
    };

    await update.onConfirmation(ctx as any);

    expect(userService.disableBroadcasts).toHaveBeenCalledWith(
      ctx.state.userSocial,
    );
    expect(ctx.api.messages.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        peer_id: 22,
        cmid: 33,
        message: LocalePhrase.Broadcast_Notification_Unsubscribed,
      }),
    );
  });

  it('deletes the VK confirmation message after cancellation', async () => {
    const update = new BroadcastVkUnsubscribeUpdate({} as any, {} as any);
    const ctx = {
      isDM: true,
      eventPayload: { broadcastUnsubscribe: 'cancel' },
      i18n: { t: jest.fn((phrase) => phrase) },
      answer: jest.fn(),
      deleteMessage: jest.fn(),
    };

    await update.onConfirmation(ctx as any);

    expect(ctx.deleteMessage).toHaveBeenCalledWith({ delete_for_all: true });
  });
});
