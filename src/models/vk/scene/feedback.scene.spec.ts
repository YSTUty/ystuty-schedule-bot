import { VkFeedbackScene } from './feedback.scene';

describe('VkFeedbackScene', () => {
  const keyboardFactory = {
    getFeedbackCategories: jest.fn().mockReturnValue('categories'),
    getStart: jest
      .fn()
      .mockReturnValue({ inline: jest.fn().mockReturnValue('start') }),
    getWelcomeFeatures: jest
      .fn()
      .mockReturnValue({ inline: jest.fn().mockReturnValue('welcome') }),
    needInline: jest.fn().mockReturnValue(false),
  };
  const scene = new VkFeedbackScene(
    {} as any,
    {} as any,
    keyboardFactory as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores VK attachment metadata instead of its string representation', () => {
    const sourceMessage = (scene as any).getSourceMessage({
      isMessageContext: jest.fn().mockReturnValue(true),
      attachments: [
        {
          type: 'sticker',
          toJSON: () => ({
            id: 125,
            productId: 7,
            images: [{ url: 'https://vk.test/sticker.png' }],
          }),
        },
      ],
      id: 10,
      conversationMessageId: 15,
      text: '',
    });

    expect(sourceMessage).toEqual({
      messageId: 10,
      conversationMessageId: 15,
      attachments: [
        {
          type: 'sticker',
          payload: {
            id: 125,
            productId: 7,
            images: [{ url: 'https://vk.test/sticker.png' }],
          },
        },
      ],
    });
  });

  it('removes the feedback menu and returns to the start screen on cancel', async () => {
    const ctx = {
      eventPayload: { feedbackAction: 'cancel' },
      scene: { state: {}, leave: jest.fn(), step: { firstTime: false } },
      isMessageEventContext: jest.fn().mockReturnValue(true),
      isMessageContext: jest.fn().mockReturnValue(false),
      answer: jest.fn(),
      deleteMessage: jest.fn().mockResolvedValue(true),
      send: jest.fn(),
      i18n: { t: jest.fn((phrase) => phrase) },
    };

    await scene.step(ctx as any);

    expect(ctx.deleteMessage).toHaveBeenCalledWith({ delete_for_all: true });
    expect(ctx.send).toHaveBeenCalledWith('page.welcome_features', {
      keyboard: 'welcome',
    });
  });
});
