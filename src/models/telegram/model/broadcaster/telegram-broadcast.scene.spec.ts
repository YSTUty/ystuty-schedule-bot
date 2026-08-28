import { i18n } from '@my-common/util/tg';

import { TelegramBroadcastScene } from './telegram-broadcast.scene';

describe('TelegramBroadcastScene', () => {
  it('renders settings for a manual audience selection', () => {
    const scene = new TelegramBroadcastScene(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const state = {
      filter: { hasDM: true, isBlockedBot: false },
      recipientsCount: 1,
      selectedRecipientIds: [2],
      manualRecipients: true,
      recipientsPage: 1,
      feedbackButton: { text: '🫡', afterClickText: '✅' },
      actionKeyboard: [
        { type: 'select_group' as const, text: 'Выбрать группу' },
        { type: 'auth' as const },
      ],
      mode: 'copy' as const,
    };
    const ctx = { i18n: i18n.createContext('ru', {}) };

    const message = (scene as any).renderSettings(ctx, state);

    expect(message).toContain('Тестовая выборка: <code>1 ID: 2</code>');
    expect(message).toContain('  • Выбор группы: <code>Выбрать группу</code>');
    expect(message).toContain(
      '  • ЯГТУ.ID: <code>Подключить или обновить ЯГТУ.ID</code>',
    );
  });

  it('sends a new action settings screen after entering a link URL', async () => {
    const keyboard = {};
    const keyboardFactory = {
      getBroadcastActionSettings: jest.fn().mockReturnValue(keyboard),
    };
    const scene = new TelegramBroadcastScene(
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
      replyWithHTML: jest.fn(),
    };

    await (scene as any).applyActionLinkUrl(ctx, 'https://ystuty.ru/');

    expect(ctx.replyWithHTML).toHaveBeenCalledTimes(1);
    expect(ctx.scene.state.awaitingActionLinkUrl).toBeUndefined();
    expect(ctx.scene.state.actionKeyboard[0].url).toBe('https://ystuty.ru/');
    expect(keyboardFactory.getBroadcastActionSettings).toHaveBeenCalledWith(
      ctx,
      ctx.scene.state.actionKeyboard,
    );
  });
});
