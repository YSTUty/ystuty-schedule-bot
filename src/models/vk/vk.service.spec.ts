import { APIError, APIErrorCode } from 'vk-io';

import { SocialType } from '@my-common/constants';

import { VkService } from './vk.service';

describe('VkService', () => {
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
});
