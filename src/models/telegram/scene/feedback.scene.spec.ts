import { TelegramFeedbackScene } from './feedback.scene';

describe('TelegramFeedbackScene', () => {
  const keyboardFactory = {
    getFeedbackCategories: jest.fn().mockReturnValue('categories'),
    getFeedbackCollector: jest.fn().mockReturnValue('collector'),
    getStart: jest.fn().mockReturnValue('start'),
    getWelcomeFeatures: jest.fn().mockReturnValue('welcome'),
  };
  const telegramService = {
    bot: { telegram: { deleteMessage: jest.fn() } },
  };
  const scene = new TelegramFeedbackScene(
    {} as any,
    telegramService as any,
    keyboardFactory as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    telegramService.bot.telegram.deleteMessage.mockResolvedValue(true);
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
