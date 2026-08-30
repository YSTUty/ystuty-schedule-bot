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

  it('uses a wall attachment and explicit admin text from a forwarded post', () => {
    const scene = new VkBroadcastScene(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const wallAttachment = {
      canBeAttached: true,
      toString: jest.fn().mockReturnValue('wall-123_456_access-key'),
    };
    const ctx = {
      id: 17,
      hasText: true,
      text: 'Текст администратора',
      hasAttachments: jest.fn().mockReturnValue(false),
      attachments: [wallAttachment],
      forwards: { flatten: [] },
      i18n: { t: jest.fn() },
    };

    const sourceMessage = (scene as any).getSourceMessage(ctx);

    expect(sourceMessage).toEqual({
      text: 'Текст администратора',
      attachment: 'wall-123_456_access-key',
      messageId: 17,
    });
    expect(wallAttachment.toString).toHaveBeenCalledTimes(1);
  });

  it('keeps a wall attachment without generated text', () => {
    const scene = new VkBroadcastScene(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      id: 18,
      hasText: false,
      hasAttachments: jest.fn().mockReturnValue(false),
      attachments: [
        {
          canBeAttached: true,
          toString: () => 'wall-123_457_access-key',
        },
      ],
      forwards: { flatten: [] },
    };

    expect((scene as any).getSourceMessage(ctx)).toEqual({
      attachment: 'wall-123_457_access-key',
      messageId: 18,
    });
  });

  it('keeps all attachable VK attachments in one broadcast source', () => {
    const scene = new VkBroadcastScene(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      id: 19,
      hasText: true,
      text: 'Текст администратора',
      hasAttachments: jest.fn().mockReturnValue(false),
      attachments: [
        { canBeAttached: true, toString: () => 'photo-123_1' },
        { canBeAttached: true, toString: () => 'wall-123_2_access-key' },
        { canBeAttached: false, toString: () => '[object LinkAttachment]' },
      ],
      forwards: { flatten: [] },
    };

    expect((scene as any).getSourceMessage(ctx)).toEqual({
      text: 'Текст администратора',
      attachment: 'photo-123_1,wall-123_2_access-key',
      messageId: 19,
    });
  });
});
