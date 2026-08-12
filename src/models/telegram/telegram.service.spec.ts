import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  it('caches chat administrators for two minutes', async () => {
    const admins = [{ user: { id: 1 }, status: 'administrator' }];
    const bot = {
      telegram: {
        getChatAdministrators: jest.fn().mockResolvedValue(admins),
      },
    };
    const redisService = {
      redis: {
        get: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(JSON.stringify(admins)),
        set: jest.fn(),
      },
    };
    const service = new TelegramService(
      bot as any,
      redisService as any,
      {} as any,
    );

    await expect(service.getCachedChatAdmins(123)).resolves.toEqual(admins);
    await expect(service.getCachedChatAdmins(123)).resolves.toEqual(admins);

    expect(bot.telegram.getChatAdministrators).toHaveBeenCalledTimes(1);
    expect(redisService.redis.set).toHaveBeenCalledWith(
      'telegram:chat-admins:123',
      JSON.stringify([{ user: { id: 1 }, status: 'administrator' }]),
      'EX',
      120,
    );
  });
});
