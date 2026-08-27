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
      keyboard: 'new keyboard',
    });
  });
});
