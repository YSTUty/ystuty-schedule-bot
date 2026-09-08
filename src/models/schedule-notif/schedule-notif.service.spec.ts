import { SocialType } from '@my-common/constants';

import { UserSocial } from '../user/entity/user-social.entity';

import { ScheduleNotifService } from './schedule-notif.service';
import {
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
  ScheduleNotifTargetType,
} from './schedule-notif.types';

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
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(async (value) => ({ id: 1, ...value })),
      update: jest.fn(),
    };
    const deliveryRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 1, ...value })),
    };
    const scheduleService = {
      getGroupByName: jest.fn((groupName) => groupName),
    };
    const metricsService = {
      incrementScheduleNotifCreated: jest.fn(),
    };

    return {
      notifRepository,
      deliveryRepository,
      metricsService,
      service: new ScheduleNotifService(
        notifRepository as any,
        deliveryRepository as any,
        scheduleService as any,
        metricsService as any,
      ),
    };
  };

  it('creates a personal group notif and reserves one delivery per scheduled moment', async () => {
    const { service, deliveryRepository, metricsService } = createService();
    const notif = await service.createForUserSocial(
      userSocial,
      {
        type: ScheduleNotifTargetType.Group,
        id: 'ЦИС-11',
      },
      {
        deliveryHour: 20,
        deliveryMinute: 0,
        period: ScheduleNotifPeriod.Day,
        targetDayOffset: ScheduleNotifTargetDayOffset.Tomorrow,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      },
    );

    const first = await service.reserveDelivery(notif.id, scheduledFor);
    deliveryRepository.save.mockRejectedValueOnce({ code: '23505' });
    const repeated = await service.reserveDelivery(notif.id, scheduledFor);

    expect(notif.targetId).toBe('ЦИС-11');
    expect(first).not.toBeNull();
    expect(repeated).toBeNull();
    expect(metricsService.incrementScheduleNotifCreated).toHaveBeenCalledWith({
      social: SocialType.Telegram,
      scope: 'personal',
      targetType: 'group',
      target: 'ЦИС-11',
    });
  });

  it('creates a personal teacher notif without requiring a selected group', async () => {
    const { service, notifRepository, metricsService } = createService();
    const teacherOnlySocial = new UserSocial({
      ...userSocial,
      groupName: null,
    });
    const scheduleService = (service as any).scheduleService;
    scheduleService.getTeacher = jest.fn().mockReturnValue({
      id: 42,
      name: 'Иванов И. И.',
    });

    await service.createForUserSocial(
      teacherOnlySocial,
      { type: ScheduleNotifTargetType.Teacher, id: '42' },
      {
        deliveryHour: 21,
        deliveryMinute: 0,
        period: ScheduleNotifPeriod.Day,
        targetDayOffset: ScheduleNotifTargetDayOffset.Today,
        weekdays: [1, 2],
      },
    );

    expect(notifRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: ScheduleNotifTargetType.Teacher,
        targetId: '42',
      }),
    );
    expect(metricsService.incrementScheduleNotifCreated).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: ScheduleNotifTargetType.Teacher }),
    );
  });

  it('keeps legacy creation of one notif for a conversation using its persistent group', async () => {
    const { service, notifRepository, metricsService } = createService();
    const conversation = {
      id: 3,
      social: 'telegram',
      groupName: 'ЦИС-11',
    };

    await service.upsertFirstConversationNotif(conversation as any, {
      deliveryHour: 8,
      deliveryMinute: 30,
      period: ScheduleNotifPeriod.Day,
      targetDayOffset: ScheduleNotifTargetDayOffset.Tomorrow,
      weekdays: [1, 2, 3, 4, 5],
    });

    expect(notifRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: conversation.id,
        transport: conversation.social,
        targetId: conversation.groupName,
      }),
    );
    expect(metricsService.incrementScheduleNotifCreated).toHaveBeenCalledWith({
      social: conversation.social,
      scope: 'conversation',
      targetType: 'group',
      target: conversation.groupName,
    });
  });

  it('creates a conversation teacher notif without a selected chat group', async () => {
    const { service, notifRepository, metricsService } = createService();
    const scheduleService = (service as any).scheduleService;
    scheduleService.getTeacher = jest.fn().mockReturnValue({
      id: 42,
      name: 'Иванов И. И.',
    });
    const conversation = {
      id: 3,
      social: SocialType.Telegram,
      groupName: null,
    };

    await service.createForConversation(
      conversation as any,
      { type: ScheduleNotifTargetType.Teacher, id: '42' },
      {
        deliveryHour: 8,
        deliveryMinute: 30,
        period: ScheduleNotifPeriod.Day,
        targetDayOffset: ScheduleNotifTargetDayOffset.Today,
        weekdays: [1, 2, 3],
      },
    );

    expect(notifRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 3,
        userSocialId: null,
        targetType: ScheduleNotifTargetType.Teacher,
        targetId: '42',
      }),
    );
    expect(metricsService.incrementScheduleNotifCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'conversation',
        targetType: ScheduleNotifTargetType.Teacher,
      }),
    );
  });

  it('does not create more than six notifs for one conversation', async () => {
    const { service, notifRepository } = createService();
    notifRepository.count.mockResolvedValue(6);

    await expect(
      service.createForConversation(
        { id: 3, social: SocialType.Telegram } as any,
        { type: ScheduleNotifTargetType.Group, id: 'ЦИС-11' },
        {
          deliveryHour: 8,
          deliveryMinute: 30,
          period: ScheduleNotifPeriod.Day,
          targetDayOffset: ScheduleNotifTargetDayOffset.Today,
          weekdays: [1],
        },
      ),
    ).rejects.toThrow('Schedule notification limit (6) reached');
  });

  it('loads due personal and conversation notifs through separate nullable relations', async () => {
    const { service, notifRepository } = createService();
    notifRepository.find
      .mockResolvedValueOnce([
        { id: 1, weekdays: [1, 2], userSocialId: userSocial.id },
      ])
      .mockResolvedValueOnce([{ id: 2, weekdays: [2], conversationId: 3 }]);

    const due = await service.findDue({
      deliveryHour: 8,
      deliveryMinute: 30,
      isoWeekday: 2,
    });

    expect(due.map((notif) => notif.id)).toEqual([1, 2]);
    expect(notifRepository.find).toHaveBeenCalledTimes(2);
    expect(notifRepository.find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        relations: ['userSocial'],
      }),
    );
    expect(notifRepository.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        relations: ['conversation'],
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
      period: ScheduleNotifPeriod.Day,
      targetDayOffset: ScheduleNotifTargetDayOffset.Today,
      weekdays: [1, 3, 5],
    });

    expect(changed).toBe(true);
    expect(notifRepository.update).toHaveBeenCalledWith(
      { id: 7, userSocialId: userSocial.id },
      {
        deliveryHour: 7,
        deliveryMinute: 30,
        period: ScheduleNotifPeriod.Day,
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
      },
      {
        targetType: 'group',
        targetId: 'ЦИС-21',
        lastError: null,
        missingTargetAttempts: 0,
      },
    );
  });
});
