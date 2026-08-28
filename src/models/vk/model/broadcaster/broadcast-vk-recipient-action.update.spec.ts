import { LocalePhrase } from '@my-interfaces';

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
      {} as any,
    );
    const calls: string[] = [];
    const ctx = {
      eventPayload: {
        deliveryId: 15,
        broadcastRecipientAction: 'select_group',
      },
      state: { userSocial: { id: 7 } },
      scene: { enter: jest.fn(async () => calls.push('scene')) },
      answer: jest.fn(async () => calls.push('answer')),
      i18n: { t: jest.fn() },
    };

    await update.onRecipientAction(ctx as any);

    expect(broadcastService.getCampaignRecipientAction).toHaveBeenCalledWith({
      deliveryId: 15,
      social: 'vkontakte',
      userSocialId: 7,
      action: 'select_group',
    });
    expect(ctx.scene.enter).toHaveBeenCalledWith('SELECT_GROUP_SCENE', {
      state: { forceNewMessage: true },
    });
    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'Готово',
    });
    expect(calls).toEqual(['scene', 'answer']);
  });

  it('does not enter the scene for an unavailable action', async () => {
    const update = new BroadcastVkRecipientActionUpdate(
      { getCampaignRecipientAction: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
    );
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

  it('opens the existing authorization scene for the auth action', async () => {
    const update = new BroadcastVkRecipientActionUpdate(
      {
        getCampaignRecipientAction: jest
          .fn()
          .mockResolvedValue({ type: 'auth' }),
      } as any,
      {} as any,
    );
    const ctx = {
      eventPayload: { deliveryId: 15, broadcastRecipientAction: 'auth' },
      state: { userSocial: { id: 7 } },
      scene: { enter: jest.fn() },
      answer: jest.fn(),
      i18n: { t: jest.fn() },
    };

    await update.onRecipientAction(ctx as any);

    expect(ctx.scene.enter).toHaveBeenCalledWith('AUTH_SCENE', {
      state: { forceNewMessage: true },
    });
    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'Готово',
    });
  });

  it('sends the regular start screen for the start action', async () => {
    const startKeyboard = { inline: jest.fn().mockReturnValue('start') };
    const welcomeKeyboard = { inline: jest.fn().mockReturnValue('welcome') };
    const keyboardFactory = {
      getStart: jest.fn().mockReturnValue(startKeyboard),
      getWelcomeFeatures: jest.fn().mockReturnValue(welcomeKeyboard),
      needInline: jest.fn().mockReturnValue(false),
    };
    const update = new BroadcastVkRecipientActionUpdate(
      {
        getCampaignRecipientAction: jest
          .fn()
          .mockResolvedValue({ type: 'start' }),
      } as any,
      keyboardFactory as any,
    );
    const ctx = {
      eventPayload: { deliveryId: 15, broadcastRecipientAction: 'start' },
      state: { userSocial: { id: 7 } },
      answer: jest.fn(),
      i18n: { t: jest.fn((phrase) => phrase) },
      send: jest.fn(),
    };

    await update.onRecipientAction(ctx as any);

    expect(ctx.send).toHaveBeenNthCalledWith(1, LocalePhrase.Page_Start, {
      keyboard: 'start',
    });
    expect(ctx.send).toHaveBeenNthCalledWith(
      2,
      LocalePhrase.Page_WelcomeFeatures,
      { keyboard: 'welcome' },
    );
    expect(keyboardFactory.getStart).toHaveBeenCalledWith(ctx);
    expect(keyboardFactory.getWelcomeFeatures).toHaveBeenCalledWith(ctx);
  });

  it('leaves the duplicate-callback protection to VK middleware', async () => {
    const update = new BroadcastVkRecipientActionUpdate(
      {
        getCampaignRecipientAction: jest
          .fn()
          .mockResolvedValue({ type: 'select_group' }),
      } as any,
      {} as any,
    );
    const ctx = {
      eventPayload: {
        deliveryId: 15,
        broadcastRecipientAction: 'select_group',
      },
      state: { userSocial: { id: 7 }, eventAnswered: false },
      scene: {
        enter: jest.fn(async () => {
          ctx.state.eventAnswered = true;
        }),
      },
      answer: jest.fn(),
      i18n: { t: jest.fn() },
    };

    await update.onRecipientAction(ctx as any);

    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'Готово',
    });
  });
});
