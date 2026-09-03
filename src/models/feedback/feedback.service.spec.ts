import { SocialType } from '@my-common/constants';

import { FeedbackService } from './feedback.service';
import { FeedbackCategory, FeedbackDeliveryStatus } from './feedback.types';

describe('FeedbackService', () => {
  const repository = {
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
  };
  const adminDeliveryRepository = {
    create: jest.fn((value) => value),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const redis = { del: jest.fn(), set: jest.fn() };
  const service = new FeedbackService(
    repository as any,
    adminDeliveryRepository as any,
    { redis } as any,
  );
  const params = {
    userSocialId: 11,
    social: SocialType.Telegram,
    category: FeedbackCategory.Suggestion,
    sourcePeerId: '123',
    content: { messages: [{ messageId: 1, text: 'Хочу новую функцию' }] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates feedback only after reserving the five-minute cooldown', async () => {
    redis.set.mockResolvedValue('OK');
    repository.save.mockResolvedValue({ id: 7, ...params });

    await expect(service.create(params)).resolves.toMatchObject({ id: 7 });
    expect(redis.set).toHaveBeenCalledWith(
      'feedback:cooldown:telegram:11',
      '1',
      'EX',
      300,
      'NX',
    );
  });

  it('does not create feedback while cooldown is active', async () => {
    redis.set.mockResolvedValue(null);

    await expect(service.create(params)).resolves.toBeNull();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('releases cooldown when database persistence fails', async () => {
    redis.set.mockResolvedValue('OK');
    repository.save.mockRejectedValue(new Error('db unavailable'));

    await expect(service.create(params)).rejects.toThrow('db unavailable');
    expect(redis.del).toHaveBeenCalledWith('feedback:cooldown:telegram:11');
  });

  it.each([
    [0, undefined, FeedbackDeliveryStatus.Failed],
    [1, 'one admin unavailable', FeedbackDeliveryStatus.Partial],
    [2, undefined, FeedbackDeliveryStatus.Sent],
  ])(
    'records delivery status for %s successful forwards',
    async (sentCount, error, status) => {
      await service.setDeliveryResult(7, {
        sentCount,
        ...(error ? { error } : {}),
      });

      expect(repository.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ deliveryStatus: status }),
      );
    },
  );
});
