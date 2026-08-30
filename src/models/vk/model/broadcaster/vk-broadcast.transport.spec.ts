import { VkBroadcastTransport } from './vk-broadcast.transport';

describe('VkBroadcastTransport', () => {
  it('sends a foreign community wall attachment with text and campaign keyboard', async () => {
    const keyboard = { inline: jest.fn().mockReturnValue('keyboard') };
    const vkService = { sendMessage: jest.fn().mockResolvedValue(42) };
    const keyboardFactory = {
      getBroadcastRecipientKeyboard: jest.fn().mockReturnValue(keyboard),
    };
    const transport = new VkBroadcastTransport(
      vkService as any,
      {} as any,
      keyboardFactory as any,
    );

    const result = await transport.sendCampaignDelivery({
      campaignId: 1,
      deliveryId: 2,
      targetSocialId: '100',
      mode: 'text' as any,
      sourceMessage: {
        text: 'Текст администратора',
        attachment: 'wall-123_456_access-key',
      },
      actionKeyboard: [{ type: 'select_group' }],
    });

    expect(vkService.sendMessage).toHaveBeenCalledWith(
      100,
      'Текст администратора',
      {
        attachment: 'wall-123_456_access-key',
        keyboard: 'keyboard',
      },
    );
    expect(keyboardFactory.getBroadcastRecipientKeyboard).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 1,
        deliveryId: 2,
        actionKeyboard: [{ type: 'select_group' }],
      }),
    );
    expect(result).toEqual({ messageId: '42' });
  });
});
