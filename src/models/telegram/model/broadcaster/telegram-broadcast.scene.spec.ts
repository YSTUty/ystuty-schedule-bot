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

  it('saves the separately sent keyboard message text for forwards', async () => {
    const keyboard = {};
    const keyboardFactory = {
      getBroadcastConfirm: jest.fn().mockReturnValue(keyboard),
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
          mode: 'forward',
          actionKeyboard: [{ type: 'select_group' }],
          awaitingForwardKeyboardMessageText: true,
          forwardKeyboardMessageText: 'Выберите действие:',
          sourceMessage: { chatId: 1, messageId: 2 } as any,
          feedbackButton: null,
          selectedRecipientIds: [],
        },
      },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
    };

    await (scene as any).applyForwardKeyboardMessageText(
      ctx,
      'Выберите подходящий вариант:',
    );

    expect(ctx.scene.state.forwardKeyboardMessageText).toBe(
      'Выберите подходящий вариант:',
    );
    expect(ctx.scene.state.awaitingForwardKeyboardMessageText).toBeUndefined();
    expect(ctx.scene.state.sourceMessage.recipientKeyboardMessageText).toBe(
      'Выберите подходящий вариант:',
    );
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'page.broadcast.ready',
      keyboard,
    );
    expect(keyboardFactory.getBroadcastConfirm).toHaveBeenCalledWith(
      ctx,
      'forward',
      true,
    );
  });

  it('stores the keyboard message text with the selected source message', async () => {
    const broadcastService = {
      countRecipients: jest.fn().mockResolvedValue(1),
    };
    const scene = new TelegramBroadcastScene(
      broadcastService as any,
      {} as any,
      {} as any,
      { getBroadcastConfirm: jest.fn().mockReturnValue({}) } as any,
    );
    const state: any = {
      filter: { hasDM: true, isBlockedBot: false },
      forwardKeyboardMessageText: 'Доступные действия:',
      manualRecipients: false,
      selectedRecipientIds: [],
    };
    const ctx = {
      message: { message_id: 75, text: 'Переслать это сообщение' },
      chat: { id: 55 },
      scene: { state },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
      wizard: { next: jest.fn() },
    };

    await scene.onMessage(ctx as any);

    expect(state.sourceMessage).toEqual({
      chatId: 55,
      messageId: 75,
      recipientKeyboardMessageText: 'Доступные действия:',
      text: 'Переслать это сообщение',
    });
  });
});
