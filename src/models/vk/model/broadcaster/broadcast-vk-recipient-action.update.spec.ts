import { BroadcastVkRecipientActionUpdate } from './broadcast-vk-recipient-action.update';

describe('BroadcastVkRecipientActionUpdate', () => {
  it('opens the existing group selection scene only for the delivery recipient', async () => {
    const broadcastService = {
      getCampaignRecipientAction: jest
        .fn()
        .mockResolvedValue({ type: 'select_group' }),
    };
    const update = new BroadcastVkRecipientActionUpdate(
      broadcastService as any,
    );
    const ctx = {
      eventPayload: {
        deliveryId: 15,
        broadcastRecipientAction: 'select_group',
      },
      state: { userSocial: { id: 7 } },
      scene: { enter: jest.fn() },
      answer: jest.fn(),
      i18n: { t: jest.fn() },
    };

    await update.onRecipientAction(ctx as any);

    expect(broadcastService.getCampaignRecipientAction).toHaveBeenCalledWith({
      deliveryId: 15,
      social: 'vkontakte',
      userSocialId: 7,
      action: 'select_group',
    });
    expect(ctx.scene.enter).toHaveBeenCalledWith('SELECT_GROUP_SCENE');
  });

  it('does not enter the scene for an unavailable action', async () => {
    const update = new BroadcastVkRecipientActionUpdate({
      getCampaignRecipientAction: jest.fn().mockResolvedValue(null),
    } as any);
    const ctx = {
      eventPayload: {
        deliveryId: 15,
        broadcastRecipientAction: 'select_group',
      },
      state: { userSocial: { id: 7 } },
      scene: { enter: jest.fn() },
      answer: jest.fn(),
      i18n: { t: jest.fn().mockReturnValue('unavailable') },
    };

    await update.onRecipientAction(ctx as any);

    expect(ctx.scene.enter).not.toHaveBeenCalled();
    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'unavailable',
    });
  });
});
