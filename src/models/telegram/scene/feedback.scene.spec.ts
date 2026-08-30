import { FeedbackCategory } from '../../feedback/feedback.types';

import { TelegramFeedbackScene } from './feedback.scene';

jest.mock('@my-environment', () => ({
  SOCIAL_TELEGRAM_ADMIN_IDS: [100, 200],
}));

describe('TelegramFeedbackScene', () => {
  const keyboardFactory = {
    getFeedbackCategories: jest.fn().mockReturnValue('categories'),
    getFeedbackCollector: jest.fn().mockReturnValue('collector'),
    getStart: jest.fn().mockReturnValue('start'),
    getWelcomeFeatures: jest.fn().mockReturnValue('welcome'),
  };
  const telegramService = {
    bot: {
      telegram: {
        deleteMessage: jest.fn(),
        sendMessage: jest.fn(),
        forwardMessages: jest.fn(),
      },
    },
  };
  const feedbackService = { setDeliveryResult: jest.fn() };
  const scene = new TelegramFeedbackScene(
    feedbackService as any,
    telegramService as any,
    keyboardFactory as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    telegramService.bot.telegram.deleteMessage.mockResolvedValue(true);
    telegramService.bot.telegram.sendMessage.mockResolvedValue({});
    telegramService.bot.telegram.forwardMessages.mockResolvedValue([]);
    feedbackService.setDeliveryResult.mockResolvedValue('sent');
  });

  it('updates the category menu in place after category selection', async () => {
    const ctx = {
      match: { groups: { category: 'bot' } },
      scene: { state: {} },
      wizard: { next: jest.fn() },
      i18n: { t: jest.fn((phrase) => phrase) },
      editMessageText: jest.fn(),
      tryAnswerCbQuery: jest.fn(),
    };

    await scene.chooseCategory(ctx as any);

    expect((ctx.scene.state as any).category).toBe('bot');
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      'page.feedback.enter_content',
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });

  it('stores Telegram attachment metadata as a JSON object', () => {
    const sourceMessage = (scene as any).getSourceMessage({
      message: {
        message_id: 10,
        caption: 'Скриншот ошибки',
        photo: [{ file_id: 'photo-id', width: 320, height: 200 }],
      },
    });

    expect(sourceMessage).toEqual({
      messageId: 10,
      text: 'Скриншот ошибки',
      attachments: [
        {
          type: 'photo',
          payload: [{ file_id: 'photo-id', width: 320, height: 200 }],
        },
      ],
    });
  });

  it('keeps additional text messages and marks them with a salute reaction', async () => {
    const ctx = {
      message: {
        message_id: 11,
        text: 'Вторая текстовка',
      },
      scene: {
        state: {
          messages: [
            { messageId: 10, text: 'Основная текстовка', isPrimary: true },
          ],
          mediaCount: 0,
        },
      },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
      react: jest.fn().mockResolvedValue(true),
    };

    await scene.collectMessage(ctx as any);

    expect(ctx.scene.state.messages).toEqual([
      { messageId: 10, text: 'Основная текстовка', isPrimary: true },
      { messageId: 11, text: 'Вторая текстовка' },
    ]);
    expect(ctx.react).toHaveBeenCalledWith('🫡');
  });

  it('marks the first feedback message with a trophy reaction', async () => {
    const ctx = {
      message: { message_id: 10, text: 'Основная текстовка' },
      scene: { state: { messages: [], mediaCount: 0 } },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
      react: jest.fn().mockResolvedValue(true),
    };

    await scene.collectMessage(ctx as any);

    expect(ctx.scene.state.messages).toEqual([
      { messageId: 10, text: 'Основная текстовка', isPrimary: true },
    ]);
    expect(ctx.react).toHaveBeenCalledWith('🏆');
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'page.feedback.first_message',
      'collector',
    );
  });

  it('notifies about the source message limit and rejects later messages', async () => {
    const messages = Array.from({ length: 9 }, (_, index) => ({
      messageId: index + 1,
    }));
    const ctx = {
      message: { message_id: 10, text: 'Десятое сообщение' },
      scene: { state: { messages, mediaCount: 0 } },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
      react: jest.fn().mockResolvedValue(true),
    };

    await scene.collectMessage(ctx as any);

    expect(ctx.scene.state.messages).toHaveLength(10);
    expect(ctx.react).toHaveBeenCalledWith('🫡');
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'page.feedback.message_limit_reached',
      'collector',
    );

    ctx.message = { message_id: 11, text: 'Лишнее сообщение' };
    await scene.collectMessage(ctx as any);

    expect(ctx.scene.state.messages).toHaveLength(10);
    expect(ctx.react).toHaveBeenLastCalledWith('💔');
  });

  it('forwards feedback to each Telegram administrator and records delivery', async () => {
    await (scene as any).forwardToAdmins(
      {
        chat: { id: 42 },
        i18n: { t: jest.fn().mockReturnValue('Ошибка бота') },
      },
      7,
      {
        category: FeedbackCategory.Bot,
        messages: [{ messageId: 10 }],
      },
    );

    expect(telegramService.bot.telegram.forwardMessages).toHaveBeenCalledTimes(
      2,
    );
    expect(telegramService.bot.telegram.forwardMessages).toHaveBeenCalledWith(
      100,
      42,
      [10],
    );
    expect(feedbackService.setDeliveryResult).toHaveBeenCalledWith(7, {
      sentCount: 2,
    });
  });

  it('removes the feedback menu and returns to the start screen on cancel', async () => {
    const ctx = {
      chat: { id: 42 },
      scene: { state: { menuMessageId: 99 } },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
    };

    await scene.onСancel(ctx as any);

    expect(telegramService.bot.telegram.deleteMessage).toHaveBeenCalledWith(
      42,
      99,
    );
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'page.welcome_features',
      'welcome',
    );
  });
});
