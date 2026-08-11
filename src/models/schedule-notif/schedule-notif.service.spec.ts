import { SocialType } from '@my-common/constants';

import { UserSocial } from '../user/entity/user-social.entity';

import { ScheduleNotifService } from './schedule-notif.service';
import { ScheduleNotifTargetDayOffset } from './schedule-notif.types';

describe('ScheduleNotifService', () => {
  const userSocial = new UserSocial({
    id: 1,
    social: SocialType.Telegram,
    socialId: 123,
    groupName: 'ЦИС-11',
    hasDM: true,
    isBlockedBot: false,
  });
  const scheduledFor = new Date('2026-08-10T17:00:00.000Z');

  const createService = () => {
    const notifRepository = {
      create: jest.fn((value) => value),
      findOne: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (value) => ({ id: 1, ...value })),
      update: jest.fn(),
    };
    const deliveryRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 1, ...value })),
    };
    const ystutyService = {
      getGroupByName: jest.fn((groupName) => groupName),
    };

    return {
      notifRepository,
      deliveryRepository,
      service: new ScheduleNotifService(
        notifRepository as any,
        deliveryRepository as any,
        ystutyService as any,
      ),
    };
  };

  it('creates a personal group notif and reserves one delivery per scheduled moment', async () => {
    const { service, deliveryRepository } = createService();
    const notif = await service.createForUserSocial(userSocial, {
      deliveryHour: 20,
      deliveryMinute: 0,
      targetDayOffset: ScheduleNotifTargetDayOffset.Tomorrow,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
    });

    const first = await service.reserveDelivery(notif.id, scheduledFor);
    deliveryRepository.save.mockRejectedValueOnce({ code: '23505' });
    const repeated = await service.reserveDelivery(
      notif.id,
      scheduledFor,
    );

    expect(notif.targetId).toBe('ЦИС-11');
    expect(first).not.toBeNull();
    expect(repeated).toBeNull();
  });

  it('updates the first-release notif instead of creating a duplicate', async () => {
    const { service, notifRepository } = createService();
    const existing = {
      id: 7,
      userSocialId: userSocial.id,
      isEnabled: false,
      targetId: 'ЦИС-11',
    };
    notifRepository.findOne.mockResolvedValue(existing);

    await service.upsertFirstNotif(userSocial, {
      deliveryHour: 21,
      deliveryMinute: 0,
      targetDayOffset: ScheduleNotifTargetDayOffset.Today,
      weekdays: [1, 2],
    });

    expect(notifRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        deliveryHour: 21,
        isEnabled: true,
      }),
    );
  });

  it('does not change another profile notif state', async () => {
    const { service, notifRepository } = createService();
    notifRepository.update.mockResolvedValue({ affected: 0 });

    const changed = await service.setEnabled(userSocial.id, 9, false);

    expect(changed).toBe(false);
    expect(notifRepository.update).toHaveBeenCalledWith(
      { id: 9, userSocialId: userSocial.id },
      { isEnabled: false },
    );
  });

  it('updates existing notif settings without replacing its group or enabled state', async () => {
    const { service, notifRepository } = createService();
    notifRepository.update.mockResolvedValue({ affected: 1 });

    const changed = await service.updateSettings(userSocial.id, 7, {
      deliveryHour: 7,
      deliveryMinute: 30,
      targetDayOffset: ScheduleNotifTargetDayOffset.Today,
      weekdays: [1, 3, 5],
    });

    expect(changed).toBe(true);
    expect(notifRepository.update).toHaveBeenCalledWith(
      { id: 7, userSocialId: userSocial.id },
      {
        deliveryHour: 7,
        deliveryMinute: 30,
        targetDayOffset: ScheduleNotifTargetDayOffset.Today,
        weekdays: [1, 3, 5],
        lastError: null,
      },
    );
  });

  it('resets missing target attempts when changing a notif group', async () => {
    const { service, notifRepository } = createService();
    notifRepository.update.mockResolvedValue({ affected: 1 });

    await service.changeGroup(userSocial.id, 7, 'ЦИС-21');

    expect(notifRepository.update).toHaveBeenCalledWith(
      {
        id: 7,
        userSocialId: userSocial.id,
        targetType: 'group',
      },
      {
        targetId: 'ЦИС-21',
        lastError: null,
        missingTargetAttempts: 0,
      },
    );
  });
});
