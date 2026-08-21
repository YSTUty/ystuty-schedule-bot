import { TelegramError } from 'telegraf';
import { APIError, APIErrorCode } from 'vk-io';

import { SocialType } from '@my-common';

import { ConversationMembershipScheduler } from './conversation-membership.scheduler';

describe('ConversationMembershipScheduler', () => {
  const createScheduler = () => {
    const socialService = {
      findActiveConversations: jest.fn(),
      findRecentlyLeavedConversations: jest.fn(),
      syncConversationMembership: jest.fn().mockResolvedValue(false),
    };
    const telegramService = { getBotChatMembership: jest.fn() };
    const vkService = { getBotConversationMembership: jest.fn() };
    const scheduler = new ConversationMembershipScheduler(
      socialService as any,
      telegramService as any,
      vkService as any,
    );
    jest.spyOn(scheduler as any, 'wait').mockResolvedValue(undefined);
    jest.spyOn((scheduler as any).logger, 'error').mockImplementation();
    jest.spyOn((scheduler as any).logger, 'warn').mockImplementation();
    jest.spyOn((scheduler as any).logger, 'log').mockImplementation();

    return { scheduler, socialService, telegramService, vkService };
  };

  it('checks active conversations in persistent order and saves changed memberships', async () => {
    const { scheduler, socialService, telegramService, vkService } =
      createScheduler();
    const telegramConversation = {
      id: 1,
      social: SocialType.Telegram,
      conversationId: -1001,
      isLeaved: false,
      chatStatus: 'member',
    };
    const vkConversation = {
      id: 2,
      social: SocialType.Vkontakte,
      conversationId: 123,
      isLeaved: false,
      chatStatus: 'member',
    };
    socialService.findActiveConversations.mockResolvedValue([
      telegramConversation,
      vkConversation,
    ]);
    telegramService.getBotChatMembership.mockResolvedValue({
      isLeaved: false,
      chatStatus: 'administrator',
    });
    vkService.getBotConversationMembership.mockResolvedValue({
      isLeaved: true,
      chatStatus: 'kicked',
    });
    socialService.syncConversationMembership.mockResolvedValue(true);

    await scheduler.run();

    expect(telegramService.getBotChatMembership).toHaveBeenCalledWith(-1001);
    expect(vkService.getBotConversationMembership).toHaveBeenCalledWith(123);
    expect(socialService.syncConversationMembership).toHaveBeenNthCalledWith(
      1,
      telegramConversation,
      { isLeaved: false, chatStatus: 'administrator' },
    );
    expect(socialService.syncConversationMembership).toHaveBeenNthCalledWith(
      2,
      vkConversation,
      { isLeaved: true, chatStatus: 'kicked' },
    );
  });

  it('waits for Telegram retry_after before continuing the same conversation', async () => {
    const { scheduler, socialService, telegramService } = createScheduler();
    const conversation = {
      id: 1,
      social: SocialType.Telegram,
      conversationId: -1001,
      isLeaved: false,
      chatStatus: 'member',
    };
    socialService.findActiveConversations.mockResolvedValue([conversation]);
    telegramService.getBotChatMembership
      .mockRejectedValueOnce(
        new TelegramError({
          error_code: 429,
          description: 'Too Many Requests',
          parameters: { retry_after: 3 },
        }),
      )
      .mockResolvedValueOnce({ isLeaved: false, chatStatus: 'member' });

    await scheduler.run();

    expect((scheduler as any).wait).toHaveBeenCalledWith(3_000);
    expect(telegramService.getBotChatMembership).toHaveBeenCalledTimes(2);
  });

  it('marks a chat as left when Telegram confirms that it is unavailable', async () => {
    const { scheduler, socialService, telegramService } = createScheduler();
    const conversation = {
      id: 1,
      social: SocialType.Telegram,
      conversationId: -1001,
      isLeaved: false,
      chatStatus: 'member',
    };
    socialService.findActiveConversations.mockResolvedValue([conversation]);
    telegramService.getBotChatMembership.mockRejectedValue(
      new TelegramError({
        error_code: 403,
        description: 'Forbidden: bot was kicked from the group chat',
      }),
    );

    await scheduler.run();

    expect(socialService.syncConversationMembership).toHaveBeenCalledWith(
      conversation,
      { isLeaved: true, chatStatus: 'kicked' },
    );
  });

  it('waits one second for a VK rate limit before retrying', async () => {
    const { scheduler, socialService, vkService } = createScheduler();
    const conversation = {
      id: 1,
      social: SocialType.Vkontakte,
      conversationId: 123,
      isLeaved: false,
      chatStatus: 'member',
    };
    socialService.findActiveConversations.mockResolvedValue([conversation]);
    vkService.getBotConversationMembership
      .mockRejectedValueOnce(
        new APIError({
          error_code: APIErrorCode.RATE_LIMIT,
          error_msg: 'Too many requests per second',
          request_params: [],
        }),
      )
      .mockResolvedValueOnce({ isLeaved: false, chatStatus: 'member' });

    await scheduler.run();

    expect((scheduler as any).wait).toHaveBeenCalledWith(1_000);
    expect(vkService.getBotConversationMembership).toHaveBeenCalledTimes(2);
  });

  it('checks only recently left conversations for bot re-invites', async () => {
    const { scheduler, socialService, telegramService } = createScheduler();
    const conversation = {
      id: 1,
      social: SocialType.Telegram,
      conversationId: -1001,
      isLeaved: true,
      chatStatus: 'kicked',
    };
    socialService.findRecentlyLeavedConversations.mockResolvedValue([
      conversation,
    ]);
    telegramService.getBotChatMembership.mockResolvedValue({
      isLeaved: false,
      chatStatus: 'member',
    });
    const now = new Date('2026-08-21T12:00:00.000Z');

    await scheduler.runRecentlyLeaved(now);

    expect(socialService.findRecentlyLeavedConversations).toHaveBeenCalledWith(
      new Date('2026-02-19T12:00:00.000Z'),
    );
    expect(socialService.syncConversationMembership).toHaveBeenCalledWith(
      conversation,
      { isLeaved: false, chatStatus: 'member' },
    );
  });
});
