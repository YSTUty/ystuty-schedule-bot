import { SocialType } from '@my-common/constants';

import { UserSocial } from '../user/entity/user-social.entity';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import { ScheduleNotifDeliveryService } from './schedule-notif-delivery.service';
import {
  ScheduleNotifDeliveryStatus,
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
  ScheduleNotifTargetType,
} from './schedule-notif.types';

describe('ScheduleNotifDeliveryService', () => {
  const userSocial = new UserSocial({
    id: 1,
    social: SocialType.Telegram,
    socialId: 123,
    groupName: 'ЦИС-11',
    hasDM: true,
    isBlockedBot: false,
  });
  const notif = {
    id: 1,
    transport: SocialType.Telegram,
    targetType: ScheduleNotifTargetType.Group,
    targetId: 'ЦИС-11',
    period: ScheduleNotifPeriod.Day,
    targetDayOffset: ScheduleNotifTargetDayOffset.Tomorrow,
    isEnabled: true,
    userSocial,
  } as ScheduleNotif;
  const delivery = {
    id: 1,
    status: ScheduleNotifDeliveryStatus.Pending,
  } as ScheduleNotifDelivery;

  const createService = () => {
    const notifRepository = { save: jest.fn(async (value) => value) };
    const deliveryQueryBuilder = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn(),
    };
    Object.values(deliveryQueryBuilder)
      .filter((value) => typeof value === 'function')
      .forEach((method) => {
        (method as jest.Mock).mockReturnValue(deliveryQueryBuilder);
      });
    const deliveryRepository = {
      save: jest.fn(async (value) => value),
      createQueryBuilder: jest.fn(() => deliveryQueryBuilder),
    };
    const scheduleService = {
      getGroupByName: jest.fn(),
      getTeacher: jest.fn(),
      findNext: jest.fn(),
    };
    const transport = {
      sendScheduleNotif: jest.fn(),
      sendMessage: jest.fn(),
    };
    const transportRegistry = { get: jest.fn(() => transport) };

    return {
      notifRepository,
      deliveryRepository,
      deliveryQueryBuilder,
      scheduleService,
      transport,
      service: new ScheduleNotifDeliveryService(
        notifRepository as any,
        deliveryRepository as any,
        scheduleService as any,
        transportRegistry as any,
      ),
    };
  };

  beforeEach(() => {
    Object.assign(notif, {
      targetType: ScheduleNotifTargetType.Group,
      targetId: 'ЦИС-11',
      period: ScheduleNotifPeriod.Day,
      targetDayOffset: ScheduleNotifTargetDayOffset.Tomorrow,
      isEnabled: true,
      missingTargetAttempts: 0,
      lastError: null,
      lastDeliveredAt: null,
      lastFailedAt: null,
      userSocial,
      conversation: null,
    });
    Object.assign(delivery, {
      status: ScheduleNotifDeliveryStatus.Pending,
      sentMessageId: null,
      error: null,
    });
  });

  it('skips a notif whose group is absent from the current Schedule API list', async () => {
    const { service, scheduleService, transport, deliveryRepository } =
      createService();
    scheduleService.getGroupByName.mockReturnValue(undefined);

    await service.deliver(notif, delivery);

    expect(transport.sendScheduleNotif).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ScheduleNotifDeliveryStatus.Skipped,
      }),
    );
    expect(notif.lastError).toBe('Group is absent from Schedule API');
  });

  it('sends tomorrow schedule and records the returned message id', async () => {
    const { service, scheduleService, transport } = createService();
    scheduleService.getGroupByName.mockReturnValue('ЦИС-11');
    scheduleService.findNext.mockResolvedValue([1, '<b>Schedule</b>']);
    transport.sendScheduleNotif.mockResolvedValue({ messageId: '42' });

    await service.deliver(notif, delivery);

    expect(scheduleService.findNext).toHaveBeenCalledWith({
      groupName: 'ЦИС-11',
      skipDays: 1,
    });
    expect(delivery.status).toBe(ScheduleNotifDeliveryStatus.Sent);
    expect(delivery.sentMessageId).toBe('42');
  });

  it('does not turn a transient transport failure into a final delivery result', async () => {
    const { service, scheduleService, transport, deliveryRepository } =
      createService();
    scheduleService.getGroupByName.mockReturnValue('ЦИС-11');
    scheduleService.findNext.mockResolvedValue([1, '<b>Schedule</b>']);
    transport.sendScheduleNotif.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(service.deliver(notif, delivery)).rejects.toThrow('ETIMEDOUT');

    expect(deliveryRepository.save).not.toHaveBeenCalled();
  });

  it('sends the current schedule week without a day offset', async () => {
    const { service, scheduleService, transport } = createService();
    Object.assign(notif, {
      period: ScheduleNotifPeriod.Week,
      targetDayOffset: null,
    });
    scheduleService.getGroupByName.mockReturnValue('ЦИС-11');
    scheduleService.findNext.mockResolvedValue([0, '<b>Week</b>']);
    transport.sendScheduleNotif.mockResolvedValue({ messageId: '42' });

    await service.deliver(notif, delivery);

    expect(scheduleService.findNext).toHaveBeenCalledWith({
      groupName: 'ЦИС-11',
      isWeek: true,
    });
  });

  it('delivers a conversation notif to its persistent messenger conversation id', async () => {
    const { service, scheduleService, transport } = createService();
    Object.assign(notif, {
      userSocial: null,
      conversation: { conversationId: -100123 },
    });
    scheduleService.getGroupByName.mockReturnValue('ЦИС-11');
    scheduleService.findNext.mockResolvedValue([1, '<b>Schedule</b>']);
    transport.sendScheduleNotif.mockResolvedValue({ messageId: '43' });

    await service.deliver(notif, delivery);

    expect(transport.sendScheduleNotif).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: { type: 'conversation', conversationId: -100123 },
      }),
    );
  });

  it('loads both possible recipients explicitly before processing a queued delivery', async () => {
    const { service, deliveryRepository, deliveryQueryBuilder } =
      createService();
    deliveryQueryBuilder.getOne.mockResolvedValue({ ...delivery, notif });

    await expect(service.getPendingDeliveryForProcessing(42)).resolves.toEqual({
      delivery: expect.objectContaining({ id: delivery.id }),
      notif,
    });

    expect(deliveryRepository.createQueryBuilder).toHaveBeenCalledWith(
      'delivery',
    );
    expect(deliveryQueryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      1,
      'delivery.notif',
      'notif',
    );
    expect(deliveryQueryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      2,
      'notif.userSocial',
      'userSocial',
    );
    expect(deliveryQueryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      3,
      'notif.conversation',
      'conversation',
    );
    expect(deliveryQueryBuilder.andWhere).toHaveBeenCalledWith(
      'delivery.status = :status',
      { status: ScheduleNotifDeliveryStatus.Pending },
    );
  });

  it('records a missing loaded conversation relation explicitly', async () => {
    const { service, deliveryRepository, transport } = createService();
    Object.assign(notif, {
      userSocial: null,
      userSocialId: null,
      conversation: null,
      conversationId: 7,
    });

    await service.deliver(notif, delivery);

    expect(transport.sendScheduleNotif).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ScheduleNotifDeliveryStatus.Skipped,
        error: 'Conversation recipient relation is unavailable',
      }),
    );
  });

  it('skips a notification for a conversation that the bot has left', async () => {
    const { service, scheduleService, transport, deliveryRepository } =
      createService();
    Object.assign(notif, {
      userSocial: null,
      conversation: { conversationId: 1, isLeaved: true },
    });

    await service.deliver(notif, delivery);

    expect(scheduleService.getGroupByName).not.toHaveBeenCalled();
    expect(transport.sendScheduleNotif).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ScheduleNotifDeliveryStatus.Skipped,
        error: 'Bot is no longer a member of the conversation',
      }),
    );
  });

  it('disables a notif and informs the recipient after the seventh missing target during the academic year', async () => {
    const { service, scheduleService, transport, notifRepository } =
      createService();
    notif.missingTargetAttempts = 6;
    scheduleService.getGroupByName.mockReturnValue(undefined);

    await service.deliver(notif, delivery, new Date('2026-09-01'));

    expect(notif).toMatchObject({
      isEnabled: false,
      missingTargetAttempts: 7,
      lastError: 'Group is absent from Schedule API',
    });
    expect(transport.sendScheduleNotif).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: { type: 'user', userSocial },
        text: expect.stringContaining('автоматически отключена'),
      }),
    );
    expect(notifRepository.save).toHaveBeenCalledWith(notif);
  });

  it('keeps the skipped delivery when the auto-disable notice cannot be sent', async () => {
    const { service, scheduleService, transport, deliveryRepository } =
      createService();
    notif.missingTargetAttempts = 6;
    scheduleService.getGroupByName.mockReturnValue(undefined);
    transport.sendScheduleNotif.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(
      service.deliver(notif, delivery, new Date('2026-09-01')),
    ).resolves.toMatchObject({
      status: ScheduleNotifDeliveryStatus.Skipped,
    });

    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ScheduleNotifDeliveryStatus.Skipped,
      }),
    );
  });

  it('does not increase missing target attempts during summer', async () => {
    const { service, scheduleService, transport } = createService();
    notif.missingTargetAttempts = 6;
    scheduleService.getGroupByName.mockReturnValue(undefined);

    await service.deliver(notif, delivery, new Date('2026-07-01'));

    expect(notif).toMatchObject({
      isEnabled: true,
      missingTargetAttempts: 6,
    });
    expect(transport.sendScheduleNotif).not.toHaveBeenCalled();
  });

  it('checks a teacher target by identifier before delivery', async () => {
    const { service, scheduleService, transport } = createService();
    Object.assign(notif, {
      targetType: ScheduleNotifTargetType.Teacher,
      targetId: '17',
    });
    scheduleService.getTeacher.mockReturnValue(undefined);

    await service.deliver(notif, delivery, new Date('2026-09-01'));

    expect(scheduleService.getTeacher).toHaveBeenCalledWith(17);
    expect(transport.sendScheduleNotif).not.toHaveBeenCalled();
    expect(notif.lastError).toBe('Teacher is absent from Schedule API');
  });
});
