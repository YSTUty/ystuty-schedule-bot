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
  });
});
