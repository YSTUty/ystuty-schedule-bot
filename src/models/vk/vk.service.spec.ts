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
    const service = new VkService(bot as any, redisService as any, {} as any);

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
});
