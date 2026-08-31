import { BroadcastMessageMode } from '../../../broadcast/broadcast.types';

import { TelegramBroadcastTransport } from './telegram-broadcast.transport';

describe('TelegramBroadcastTransport', () => {
  it('sends an inline keyboard in a separate bot message after forwarding', async () => {
    const replyMarkup = {
      inline_keyboard: [[{ text: 'Выбрать группу', callback_data: 'action' }]],
    };
    const telegram = {
      forwardMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
      sendMessage: jest.fn().mockResolvedValue({ message_id: 43 }),
    };
    const keyboardFactory = {
      getBroadcastRecipientKeyboard: jest.fn().mockReturnValue({
        reply_markup: replyMarkup,
      }),
    };
    const transport = new TelegramBroadcastTransport(
      { bot: { telegram } } as any,
      {} as any,
      keyboardFactory as any,
    );

    const result = await transport.sendCampaignDelivery({
      campaignId: 1,
      deliveryId: 2,
      targetSocialId: '100',
      mode: BroadcastMessageMode.Forward,
      sourceMessage: {
        chatId: 200,
        messageId: 300,
        recipientKeyboardMessageText: 'Выберите подходящий вариант:',
      },
      actionKeyboard: [{ type: 'select_group' }],
    });

    expect(telegram.forwardMessage).toHaveBeenCalledWith(100, 200, 300);
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      100,
      'Выберите подходящий вариант:',
      { reply_markup: replyMarkup },
    );
    expect(result).toEqual({ messageId: '["42","43"]' });
  });

  it('deletes both forwarded and keyboard messages of one delivery', async () => {
    const telegram = {
      deleteMessage: jest.fn().mockResolvedValue(true),
    };
    const transport = new TelegramBroadcastTransport(
      { bot: { telegram } } as any,
      {} as any,
      {} as any,
    );

    const result = await transport.deleteCampaignDelivery({
      targetSocialId: '100',
      messageId: '["42","43"]',
    });

    expect(telegram.deleteMessage).toHaveBeenNthCalledWith(1, 100, 42);
    expect(telegram.deleteMessage).toHaveBeenNthCalledWith(2, 100, 43);
    expect(result).toBe(true);
  });
});
