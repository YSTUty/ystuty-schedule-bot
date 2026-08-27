import { BroadcastTelegramRecipientActionUpdate } from './broadcast-telegram-recipient-action.update';

describe('BroadcastTelegramRecipientActionUpdate', () => {
  it('opens the existing group selection scene only for the delivery recipient', async () => {
    const broadcastService = {
      getCampaignRecipientAction: jest
        .fn()
        .mockResolvedValue({ type: 'select_group' }),
    };
    const update = new BroadcastTelegramRecipientActionUpdate(
      broadcastService as any,
    );
    const calls: string[] = [];
    const ctx = {
      match: {
        groups: { deliveryId: '15', action: 'select_group' },
      },
      userSocial: { id: 7 },
      scene: { enter: jest.fn(async () => calls.push('scene')) },
      tryAnswerCbQuery: jest.fn(async () => calls.push('answer')),
      i18n: { t: jest.fn() },
    };

    await update.onRecipientAction(ctx as any);

    expect(broadcastService.getCampaignRecipientAction).toHaveBeenCalledWith({
      deliveryId: 15,
      social: 'telegram',
      userSocialId: 7,
      action: 'select_group',
    });
    expect(ctx.scene.enter).toHaveBeenCalledWith('SELECT_GROUP_SCENE', {
      forceNewMessage: true,
    });
    expect(calls).toEqual(['scene', 'answer']);
  });

  it('does not enter the scene for an unavailable action', async () => {
    const update = new BroadcastTelegramRecipientActionUpdate({
      getCampaignRecipientAction: jest.fn().mockResolvedValue(null),
    } as any);
    const ctx = {
      match: {
        groups: { deliveryId: '15', action: 'select_group' },
      },
      userSocial: { id: 7 },
      scene: { enter: jest.fn() },
      tryAnswerCbQuery: jest.fn(),
      i18n: { t: jest.fn().mockReturnValue('unavailable') },
    };

    await update.onRecipientAction(ctx as any);

    expect(ctx.scene.enter).not.toHaveBeenCalled();
    expect(ctx.tryAnswerCbQuery).toHaveBeenCalledWith('unavailable');
  });

  it('opens the existing authorization scene for the auth action', async () => {
    const update = new BroadcastTelegramRecipientActionUpdate({
      getCampaignRecipientAction: jest.fn().mockResolvedValue({ type: 'auth' }),
    } as any);
    const ctx = {
      match: { groups: { deliveryId: '15', action: 'auth' } },
      userSocial: { id: 7 },
      scene: { enter: jest.fn() },
      tryAnswerCbQuery: jest.fn(),
      i18n: { t: jest.fn() },
    };

    await update.onRecipientAction(ctx as any);

    expect(ctx.scene.enter).toHaveBeenCalledWith('AUTH_SCENE', {
      forceNewMessage: true,
    });
  });
});
