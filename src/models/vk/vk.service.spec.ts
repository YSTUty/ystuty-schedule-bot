import { APIError, APIErrorCode } from 'vk-io';

import { SocialType } from '@my-common/constants';

import { VkService } from './vk.service';

describe('VkService', () => {
  it('sends an outgoing message when VK is active', async () => {
    const send = jest.fn().mockResolvedValue(42);
    const service = new VkService(
      { api: { messages: { send } } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'isActive', 'get').mockReturnValue(true);

    await expect(service.sendMessage(123, 'Hello')).resolves.toBe(42);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ peer_id: 123, message: 'Hello' }),
    );
  });

  it('does not send an outgoing message when VK is inactive', async () => {
    const send = jest.fn();
    const service = new VkService(
      { api: { messages: { send } } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'isActive', 'get').mockReturnValue(false);

    await expect(service.sendMessage(123, 'Hello')).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('caches conversation members for two minutes', async () => {
    const items = [{ member_id: 1, is_admin: true }];
    const bot = {
      api: {
        messages: {
          getConversationMembers: jest.fn().mockResolvedValue({ items }),
        },
      },
    };
    const redisService = {
      redis: {
        get: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(JSON.stringify(items)),
        set: jest.fn(),
      },
    };
    const service = new VkService(
      bot as any,
      {} as any,
      redisService as any,
      {} as any,
      {} as any,
    );

    await expect(service.getCachedConvMembers(2000000001)).resolves.toEqual(
      items,
    );
    await expect(service.getCachedConvMembers(2000000001)).resolves.toEqual(
      items,
    );

    expect(bot.api.messages.getConversationMembers).toHaveBeenCalledTimes(1);
    expect(redisService.redis.set).toHaveBeenCalledWith(
      'vk:conversation-members:2000000001',
      JSON.stringify([{ member_id: 1, is_admin: true }]),
      'EX',
      120,
    );
  });

  it('marks a chat as left when VK confirms that the bot was kicked', async () => {
    const error = new APIError({
      error_code: APIErrorCode.PERMISSION,
      error_msg:
        'Permission to perform this action is denied: the user was kicked out of the conversation',
      request_params: [],
    });
    const bot = {
      api: {
        messages: {
          send: jest.fn().mockRejectedValue(error),
        },
      },
    };
    const socialService = {
      markConversationAsLeaved: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new VkService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
      socialService as any,
    );
    jest.spyOn(service, 'isActive', 'get').mockReturnValue(true);
    jest.spyOn((service as any).logger, 'warn').mockImplementation();
    jest.spyOn((service as any).logger, 'error').mockImplementation();

    await expect(
      service.sendMessage(2_000_000_001, 'Расписание'),
    ).resolves.toBe(false);

    expect(socialService.markConversationAsLeaved).toHaveBeenCalledWith(
      SocialType.Vkontakte,
      1,
    );
  });

  it('preserves VK API errors for a background delivery retry policy', async () => {
    const error = new APIError({
      error_code: APIErrorCode.RATE_LIMIT,
      error_msg: 'Too many requests per second',
      request_params: [],
    });
    const bot = {
      api: {
        messages: {
          send: jest.fn().mockRejectedValue(error),
        },
      },
    };
    const service = new VkService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'isActive', 'get').mockReturnValue(true);

    await expect(service.sendMessageOrThrow(123, 'Расписание')).rejects.toBe(
      error,
    );
  });

  it('reads the bot role in a VK conversation without using cache', async () => {
    const bot = {
      api: {
        messages: {
          getConversationMembers: jest.fn().mockResolvedValue({
            items: [{ member_id: -42, is_admin: true, is_owner: false }],
          }),
        },
      },
    };
    const service = new VkService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getBotConversationMembership(123, 42),
    ).resolves.toEqual({ isLeaved: false, chatStatus: 'administrator' });

    expect(bot.api.messages.getConversationMembers).toHaveBeenCalledWith({
      peer_id: 2_000_000_123,
      group_id: expect.any(Number),
      count: 1_000,
    });
  });
});
