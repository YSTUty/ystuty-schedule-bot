import { SocialType } from '@my-common/constants';

import { UserSocial } from '../user/entity/user-social.entity';

import { ScheduleNotificationService } from './schedule-notification.service';
import { ScheduleNotificationTargetDayOffset } from './schedule-notification.types';

describe('ScheduleNotificationService', () => {
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
    const notificationRepository = {
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
      notificationRepository,
      deliveryRepository,
      service: new ScheduleNotificationService(
        notificationRepository as any,
        deliveryRepository as any,
        ystutyService as any,
      ),
    };
  };

  it('creates a personal group notification and reserves one delivery per scheduled moment', async () => {
    const { service, deliveryRepository } = createService();
    const notification = await service.createForUserSocial(userSocial, {
      deliveryHour: 20,
      deliveryMinute: 0,
      targetDayOffset: ScheduleNotificationTargetDayOffset.Tomorrow,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
    });

    const first = await service.reserveDelivery(notification.id, scheduledFor);
    deliveryRepository.save.mockRejectedValueOnce({ code: '23505' });
    const repeated = await service.reserveDelivery(
      notification.id,
      scheduledFor,
    );

    expect(notification.targetId).toBe('ЦИС-11');
    expect(first).not.toBeNull();
    expect(repeated).toBeNull();
  });

  it('updates the first-release notification instead of creating a duplicate', async () => {
    const { service, notificationRepository } = createService();
    const existing = {
      id: 7,
      userSocialId: userSocial.id,
      isEnabled: false,
      targetId: 'ЦИС-11',
    };
    notificationRepository.findOne.mockResolvedValue(existing);

    await service.upsertFirstNotification(userSocial, {
      deliveryHour: 21,
      deliveryMinute: 0,
      targetDayOffset: ScheduleNotificationTargetDayOffset.Today,
      weekdays: [1, 2],
    });

    expect(notificationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        deliveryHour: 21,
        isEnabled: true,
      }),
    );
  });

  it('does not change another profile notification state', async () => {
    const { service, notificationRepository } = createService();
    notificationRepository.update.mockResolvedValue({ affected: 0 });

    const changed = await service.setEnabled(userSocial.id, 9, false);

    expect(changed).toBe(false);
    expect(notificationRepository.update).toHaveBeenCalledWith(
      { id: 9, userSocialId: userSocial.id },
      { isEnabled: false },
    );
  });

  it('updates existing notification settings without replacing its group or enabled state', async () => {
    const { service, notificationRepository } = createService();
    notificationRepository.update.mockResolvedValue({ affected: 1 });

    const changed = await service.updateSettings(userSocial.id, 7, {
      deliveryHour: 7,
      deliveryMinute: 30,
      targetDayOffset: ScheduleNotificationTargetDayOffset.Today,
      weekdays: [1, 3, 5],
    });

    expect(changed).toBe(true);
    expect(notificationRepository.update).toHaveBeenCalledWith(
      { id: 7, userSocialId: userSocial.id },
      {
        deliveryHour: 7,
        deliveryMinute: 30,
        targetDayOffset: ScheduleNotificationTargetDayOffset.Today,
        weekdays: [1, 3, 5],
        lastError: null,
      },
    );
  });
});
