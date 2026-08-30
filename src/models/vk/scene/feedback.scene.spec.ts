import { FeedbackCategory } from '../../feedback/feedback.types';
import { VK_REACTION_IDS } from '../vk.constants';

import { VkFeedbackScene } from './feedback.scene';

jest.mock('@my-environment', () => ({
  SOCIAL_VK_ADMIN_IDS: [100, 200],
}));

describe('VkFeedbackScene', () => {
  const keyboardFactory = {
    getFeedbackCategories: jest.fn().mockReturnValue('categories'),
    getFeedbackCollector: jest.fn().mockReturnValue('collector'),
    getStart: jest
      .fn()
      .mockReturnValue({ inline: jest.fn().mockReturnValue('start') }),
    getWelcomeFeatures: jest
      .fn()
      .mockReturnValue({ inline: jest.fn().mockReturnValue('welcome') }),
    needInline: jest.fn().mockReturnValue(false),
  };
  const feedbackService = { setDeliveryResult: jest.fn() };
  const vkService = {
    sendMessage: jest.fn(),
    bot: { api: { messages: { send: jest.fn(), sendReaction: jest.fn() } } },
  };
  const scene = new VkFeedbackScene(
    feedbackService as any,
    vkService as any,
    keyboardFactory as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    vkService.sendMessage.mockResolvedValue(1);
    vkService.bot.api.messages.send.mockResolvedValue(1);
    vkService.bot.api.messages.sendReaction.mockResolvedValue(1);
    feedbackService.setDeliveryResult.mockResolvedValue('sent');
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

  it('keeps a media caption after the main text message', async () => {
    const ctx = {
      isMessageEventContext: jest.fn().mockReturnValue(false),
      isMessageContext: jest.fn().mockReturnValue(true),
      attachments: [{ type: 'photo', toJSON: () => ({ id: 15 }) }],
      text: 'Вторая текстовка',
      id: 11,
      scene: {
        state: {
          messages: [
            { messageId: 10, text: 'Основная текстовка', isPrimary: true },
          ],
          mediaCount: 0,
        },
        step: { firstTime: false },
      },
      send: jest.fn(),
      i18n: { t: jest.fn((phrase) => phrase) },
    };

    await scene.step(ctx as any);

    expect(ctx.scene.state.messages).toEqual([
      { messageId: 10, text: 'Основная текстовка', isPrimary: true },
      {
        messageId: 11,
        text: 'Вторая текстовка',
        attachments: [{ type: 'photo', payload: { id: 15 } }],
      },
    ]);
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('marks accepted and rejected feedback messages with VK reactions', async () => {
    const ctx = {
      isMessageEventContext: jest.fn().mockReturnValue(false),
      isMessageContext: jest.fn().mockReturnValue(true),
      attachments: [],
      text: 'Основная текстовка',
      id: 10,
      peerId: 20,
      conversationMessageId: 30,
      scene: {
        state: { messages: [] as { messageId: number }[], mediaCount: 0 },
        step: { firstTime: false },
      },
      send: jest.fn(),
      i18n: { t: jest.fn((phrase) => phrase) },
    };

    await scene.step(ctx as any);

    expect(vkService.bot.api.messages.sendReaction).toHaveBeenCalledWith({
      peer_id: 20,
      cmid: 30,
      reaction_id: VK_REACTION_IDS['🏆'],
    });
    expect(ctx.send).toHaveBeenCalledWith('page.feedback.first_message', {
      keyboard: 'collector',
    });

    ctx.text = 'Дополнение';
    ctx.id = 11;
    ctx.conversationMessageId = 31;
    await scene.step(ctx as any);

    expect(vkService.bot.api.messages.sendReaction).toHaveBeenLastCalledWith({
      peer_id: 20,
      cmid: 31,
      reaction_id: VK_REACTION_IDS['👌'],
    });

    ctx.scene.state.messages = Array.from({ length: 10 }, (_, index) => ({
      messageId: index + 1,
    }));
    ctx.id = 12;
    ctx.conversationMessageId = 32;
    await scene.step(ctx as any);

    expect(vkService.bot.api.messages.sendReaction).toHaveBeenLastCalledWith({
      peer_id: 20,
      cmid: 32,
      reaction_id: VK_REACTION_IDS['👎'],
    });
  });

  it('notifies about the source message limit after accepting the tenth message', async () => {
    const ctx = {
      isMessageEventContext: jest.fn().mockReturnValue(false),
      isMessageContext: jest.fn().mockReturnValue(true),
      attachments: [],
      text: 'Десятое сообщение',
      id: 10,
      peerId: 20,
      conversationMessageId: 30,
      scene: {
        state: {
          messages: Array.from({ length: 9 }, (_, index) => ({
            messageId: index + 1,
          })),
          mediaCount: 0,
        },
        step: { firstTime: false },
      },
      send: jest.fn(),
      i18n: { t: jest.fn((phrase) => phrase) },
    };

    await scene.step(ctx as any);

    expect(ctx.send).toHaveBeenCalledWith(
      'page.feedback.message_limit_reached',
      { keyboard: 'collector' },
    );
  });

  it('does not forward feedback without a delivered VK header', async () => {
    vkService.sendMessage.mockResolvedValue(false);

    await (scene as any).forwardToAdmins(
      { i18n: { t: jest.fn().mockReturnValue('Ошибка бота') } },
      7,
      {
        category: FeedbackCategory.Bot,
        messages: [{ messageId: 10 }],
      },
    );

    expect(vkService.bot.api.messages.send).not.toHaveBeenCalled();
    expect(feedbackService.setDeliveryResult).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        sentCount: 0,
        error: expect.stringContaining('Failed to send feedback header'),
      }),
    );
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
