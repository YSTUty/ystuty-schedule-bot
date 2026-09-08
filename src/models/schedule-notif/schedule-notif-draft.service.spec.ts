import { SocialType } from '@my-common/constants';

import { ScheduleNotifDraftService } from './schedule-notif-draft.service';
import { ScheduleNotifPeriod } from './schedule-notif.types';

describe('ScheduleNotifDraftService', () => {
  const draft = {
    transport: SocialType.Telegram,
    ownerId: 10,
    peerId: 10,
    userSocialId: 5,
    settings: {
      deliveryHour: 8,
      deliveryMinute: 30,
      period: ScheduleNotifPeriod.Day,
      targetDayOffset: 0,
      weekdays: [1],
    },
  };

  it('creates an expiring draft and binds it to the transport context', async () => {
    const redis = { set: jest.fn() };
    const service = new ScheduleNotifDraftService({ redis } as any);

    const id = await service.create(draft);

    expect(id).toMatch(/^[a-f0-9]{12}$/);
    expect(redis.set).toHaveBeenCalledWith(
      `ystuty:schedule-notif-draft:${id}`,
      JSON.stringify(draft),
      'EX',
      15 * 60,
    );
  });

  it('does not reveal a draft to a different owner and consumes a valid one', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(draft)),
      del: jest.fn(),
    };
    const service = new ScheduleNotifDraftService({ redis } as any);
    const id = '0123456789ab';

    await expect(
      service.get(id, {
        transport: SocialType.Telegram,
        ownerId: 11,
        peerId: 10,
      }),
    ).resolves.toBeNull();
    expect(redis.del).not.toHaveBeenCalled();

    await expect(
      service.consume(id, {
        transport: SocialType.Telegram,
        ownerId: 10,
        peerId: 10,
      }),
    ).resolves.toEqual(draft);
    expect(redis.del).toHaveBeenCalledWith(`ystuty:schedule-notif-draft:${id}`);
  });
});
