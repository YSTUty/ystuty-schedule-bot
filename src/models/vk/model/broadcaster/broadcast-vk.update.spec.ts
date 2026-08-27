import { ListenerDecorator } from 'nestjs-vk';

import { BroadcastVkFeedbackUpdate } from './broadcast-vk-feedback.update';
import { BroadcastVkRecipientActionUpdate } from './broadcast-vk-recipient-action.update';
import { BroadcastVkUpdate } from './broadcast-vk.update';

describe('BroadcastVkUpdate', () => {
  it('only routes supported broadcast callbacks', () => {
    const listener = Reflect.getMetadata(
      ListenerDecorator.KEY,
      BroadcastVkUpdate.prototype.onQueueAction,
    ).find(
      (item: { handlerType: string }) => item.handlerType === 'message_event',
    );

    expect(listener.event({ broadcastAction: 'menuPanel' }, {})).toBe(true);
    expect(listener.event({ broadcastAction: 'deleteSelect' }, {})).toBe(true);
    expect(listener.event({ broadcastAction: 'create' }, {})).toBe(false);
    expect(listener.event({ groupAction: 'select' }, {})).toBe(false);
  });

  it('routes only current broadcast feedback callbacks', () => {
    const listener = Reflect.getMetadata(
      ListenerDecorator.KEY,
      BroadcastVkFeedbackUpdate.prototype.onBroadcastFeedback,
    ).find(
      (item: { handlerType: string }) => item.handlerType === 'message_event',
    );

    expect(
      listener.event(
        { broadcastFeedbackAction: 'initial', deliveryId: 15 },
        {},
      ),
    ).toBe(true);
    expect(
      listener.event({ broadcastFeedback: true, deliveryId: 15 }, {}),
    ).toBe(false);
    expect(listener.event({ broadcastFeedbackAction: 'invalid' }, {})).toBe(
      false,
    );
  });

  it('routes recipient action callbacks with a valid delivery id', () => {
    const listener = Reflect.getMetadata(
      ListenerDecorator.KEY,
      BroadcastVkRecipientActionUpdate.prototype.onRecipientAction,
    ).find(
      (item: { handlerType: string }) => item.handlerType === 'message_event',
    );

    expect(
      listener.event(
        { broadcastRecipientAction: 'future_action', deliveryId: 15 },
        {},
      ),
    ).toBe(true);
    expect(
      listener.event(
        { broadcastRecipientAction: 'select_group', deliveryId: 'invalid' },
        {},
      ),
    ).toBe(false);
    expect(listener.event({ groupAction: 'select' }, {})).toBe(false);
  });

  it('synchronizes an old initial feedback button after a duplicate click', async () => {
    const broadcastService = {
      recordCampaignFeedback: jest.fn().mockResolvedValue({
        created: false,
        feedbackButton: { afterClickText: 'Готово' },
      }),
    };
    const keyboard = { inline: jest.fn().mockReturnValue('new keyboard') };
    const keyboardFactory = {
      getBroadcastRecipientKeyboard: jest.fn().mockReturnValue(keyboard),
    };
    const update = new BroadcastVkFeedbackUpdate(
      broadcastService as any,
      keyboardFactory as any,
    );
    const ctx = {
      eventPayload: { broadcastFeedbackAction: 'initial', deliveryId: 15 },
      peerId: 123,
      conversationMessageId: 456,
      state: { userSocial: { id: 7 } },
      api: {
        messages: {
          getByConversationMessageId: jest.fn().mockResolvedValue({
            items: [{ text: 'Исходный текст рассылки' }],
          }),
          edit: jest.fn(),
        },
      },
      i18n: { t: jest.fn().mockReturnValue('already received') },
      answer: jest.fn(),
    };

    await update.onBroadcastFeedback(ctx as any);

    expect(keyboardFactory.getBroadcastRecipientKeyboard).toHaveBeenCalledWith({
      deliveryId: 15,
      actionKeyboard: undefined,
      feedbackAction: 'repeat',
      feedbackButton: { text: 'Готово' },
    });
    expect(ctx.api.messages.edit).toHaveBeenCalledWith({
      peer_id: 123,
      cmid: 456,
      message: 'Исходный текст рассылки',
      keep_forward_messages: 1,
      keep_snippets: 1,
      keyboard: 'new keyboard',
    });
  });

  it('recreates an immutable sticker feedback message without its deleted button', async () => {
    const broadcastService = {
      recordCampaignFeedback: jest.fn().mockResolvedValue({
        created: true,
        feedbackButton: { text: '🫡', afterClickMode: 'delete' },
      }),
    };
    const keyboard = { inline: jest.fn().mockReturnValue('new keyboard') };
    const keyboardFactory = {
      getBroadcastRecipientKeyboard: jest.fn().mockReturnValue(keyboard),
    };
    const update = new BroadcastVkFeedbackUpdate(
      broadcastService as any,
      keyboardFactory as any,
    );
    const ctx = {
      eventPayload: { broadcastFeedbackAction: 'initial', deliveryId: 15 },
      peerId: 123,
      conversationMessageId: 456,
      state: { userSocial: { id: 7 } },
      api: {
        messages: {
          getByConversationMessageId: jest.fn().mockResolvedValue({
            items: [
              {
                id: 789,
                text: '',
                attachments: [{ type: 'sticker', sticker: { sticker_id: 42 } }],
              },
            ],
          }),
          edit: jest.fn(),
          delete: jest.fn(),
          send: jest.fn(),
        },
      },
      i18n: { t: jest.fn().mockReturnValue('received') },
      answer: jest.fn(),
    };

    await update.onBroadcastFeedback(ctx as any);

    expect(ctx.api.messages.edit).not.toHaveBeenCalled();
    expect(ctx.api.messages.delete).toHaveBeenCalledWith({
      peer_id: 123,
      message_ids: [789],
      delete_for_all: 1,
    });
    expect(keyboardFactory.getBroadcastRecipientKeyboard).toHaveBeenCalledWith({
      deliveryId: 15,
      actionKeyboard: undefined,
      feedbackAction: 'repeat',
      feedbackButton: null,
    });
    expect(ctx.api.messages.send).toHaveBeenCalledWith(
      expect.objectContaining({
        peer_id: 123,
        sticker_id: 42,
        keyboard: 'new keyboard',
      }),
    );
    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'received',
    });
  });

  it('preserves a wall attachment when updating a feedback keyboard', async () => {
    const broadcastService = {
      recordCampaignFeedback: jest.fn().mockResolvedValue({
        created: true,
        feedbackButton: { afterClickText: null },
      }),
    };
    const keyboard = { inline: jest.fn().mockReturnValue('new keyboard') };
    const keyboardFactory = {
      getBroadcastRecipientKeyboard: jest.fn().mockReturnValue(keyboard),
    };
    const update = new BroadcastVkFeedbackUpdate(
      broadcastService as any,
      keyboardFactory as any,
    );
    const ctx = {
      eventPayload: { broadcastFeedbackAction: 'initial', deliveryId: 15 },
      peerId: 123,
      conversationMessageId: 456,
      state: { userSocial: { id: 7 } },
      api: {
        messages: {
          getByConversationMessageId: jest.fn().mockResolvedValue({
            items: [
              {
                text: '',
                attachments: [
                  {
                    type: 'wall',
                    wall: { id: 42, owner_id: -123, access_key: 'secret' },
                  },
                ],
              },
            ],
          }),
          edit: jest.fn(),
        },
      },
      i18n: { t: jest.fn().mockReturnValue('received') },
      answer: jest.fn(),
    };

    await update.onBroadcastFeedback(ctx as any);

    expect(ctx.api.messages.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: 'wall-123_42_secret',
        keep_forward_messages: 1,
        keep_snippets: 1,
        keyboard: 'new keyboard',
      }),
    );
  });
});
