import { VkBroadcastScene } from './vk-broadcast.scene';

describe('VkBroadcastScene', () => {
  it('sends a new action settings screen after entering a link URL', async () => {
    const keyboard = { inline: jest.fn().mockReturnValue('keyboard') };
    const keyboardFactory = {
      getBroadcastActionSettings: jest.fn().mockReturnValue(keyboard),
    };
    const scene = new VkBroadcastScene(
      {} as any,
      {} as any,
      {} as any,
      keyboardFactory as any,
    );
    const ctx = {
      scene: {
        state: {
          actionKeyboard: [
            { type: 'link', text: 'Открыть', url: 'https://old.ystuty.ru/' },
          ],
          awaitingActionLinkUrl: true,
        },
      },
      i18n: { t: jest.fn((phrase) => phrase) },
      isMessageEventContext: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    };

    await (scene as any).applyActionLinkUrl(ctx, 'https://ystuty.ru/');

    expect(ctx.send).toHaveBeenCalledWith('page.broadcast.action_settings', {
      keyboard: 'keyboard',
    });
    expect(ctx.scene.state.awaitingActionLinkUrl).toBeUndefined();
    expect(ctx.scene.state.actionKeyboard[0].url).toBe('https://ystuty.ru/');
    expect(keyboardFactory.getBroadcastActionSettings).toHaveBeenCalledWith(
      ctx,
      ctx.scene.state.actionKeyboard,
    );
  });
});
