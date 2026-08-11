import { SocialType } from '@my-common/constants';

import { UserSocial } from '../user/entity/user-social.entity';

import { ScheduleNotificationDelivery } from './entity/schedule-notification-delivery.entity';
import { ScheduleNotification } from './entity/schedule-notification.entity';
import { ScheduleNotificationDeliveryService } from './schedule-notification-delivery.service';
import {
  ScheduleNotificationDeliveryStatus,
  ScheduleNotificationTargetDayOffset,
  ScheduleNotificationTargetType,
} from './schedule-notification.types';

describe('ScheduleNotificationDeliveryService', () => {
  const userSocial = new UserSocial({
    id: 1,
    social: SocialType.Telegram,
    socialId: 123,
    groupName: 'ЦИС-11',
    hasDM: true,
    isBlockedBot: false,
  });
  const notification = {
    id: 1,
    transport: SocialType.Telegram,
    targetType: ScheduleNotificationTargetType.Group,
    targetId: 'ЦИС-11',
    targetDayOffset: ScheduleNotificationTargetDayOffset.Tomorrow,
    isEnabled: true,
    userSocial,
  } as ScheduleNotification;
  const delivery = {
    id: 1,
    status: ScheduleNotificationDeliveryStatus.Pending,
  } as ScheduleNotificationDelivery;

  const createService = () => {
    const notificationRepository = { save: jest.fn(async (value) => value) };
    const deliveryRepository = { save: jest.fn(async (value) => value) };
    const ystutyService = {
      getGroupByName: jest.fn(),
      getTeacher: jest.fn(),
      findNext: jest.fn(),
    };
    const transport = {
      sendScheduleNotification: jest.fn(),
      sendMessage: jest.fn(),
    };
    const transportRegistry = { get: jest.fn(() => transport) };

    return {
      notificationRepository,
      deliveryRepository,
      ystutyService,
      transport,
      service: new ScheduleNotificationDeliveryService(
        notificationRepository as any,
        deliveryRepository as any,
        ystutyService as any,
        transportRegistry as any,
      ),
    };
  };

  beforeEach(() => {
    Object.assign(notification, {
      targetType: ScheduleNotificationTargetType.Group,
      targetId: 'ЦИС-11',
      isEnabled: true,
      missingTargetAttempts: 0,
      lastError: null,
      lastDeliveredAt: null,
      lastFailedAt: null,
    });
    Object.assign(delivery, {
      status: ScheduleNotificationDeliveryStatus.Pending,
      sentMessageId: null,
      error: null,
    });
  });

  it('skips a notification whose group is absent from the current Schedule API list', async () => {
    const { service, ystutyService, transport, deliveryRepository } =
      createService();
    ystutyService.getGroupByName.mockReturnValue(undefined);

    await service.deliver(notification, delivery);

    expect(transport.sendScheduleNotification).not.toHaveBeenCalled();
    expect(deliveryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ScheduleNotificationDeliveryStatus.Skipped,
      }),
    );
    expect(notification.lastError).toBe('Group is absent from Schedule API');
  });

  it('sends tomorrow schedule and records the returned message id', async () => {
    const { service, ystutyService, transport } = createService();
    ystutyService.getGroupByName.mockReturnValue('ЦИС-11');
    ystutyService.findNext.mockResolvedValue([1, '<b>Schedule</b>']);
    transport.sendScheduleNotification.mockResolvedValue({ messageId: '42' });

    await service.deliver(notification, delivery);

    expect(ystutyService.findNext).toHaveBeenCalledWith({
      groupName: 'ЦИС-11',
      skipDays: 1,
    });
    expect(delivery.status).toBe(ScheduleNotificationDeliveryStatus.Sent);
    expect(delivery.sentMessageId).toBe('42');
  });

  it('disables a notification and informs the recipient after the seventh missing target during the academic year', async () => {
    const { service, ystutyService, transport, notificationRepository } =
      createService();
    notification.missingTargetAttempts = 6;
    ystutyService.getGroupByName.mockReturnValue(undefined);

    await service.deliver(notification, delivery, new Date('2026-09-01'));

    expect(notification).toMatchObject({
      isEnabled: false,
      missingTargetAttempts: 7,
      lastError: 'Group is absent from Schedule API',
    });
    expect(transport.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: userSocial,
        text: expect.stringContaining('автоматически отключена'),
      }),
    );
    expect(notificationRepository.save).toHaveBeenCalledWith(notification);
  });

  it('does not increase missing target attempts during summer', async () => {
    const { service, ystutyService, transport } = createService();
    notification.missingTargetAttempts = 6;
    ystutyService.getGroupByName.mockReturnValue(undefined);

    await service.deliver(notification, delivery, new Date('2026-07-01'));

    expect(notification).toMatchObject({
      isEnabled: true,
      missingTargetAttempts: 6,
    });
    expect(transport.sendScheduleNotification).not.toHaveBeenCalled();
  });

  it('checks a teacher target by identifier before delivery', async () => {
    const { service, ystutyService, transport } = createService();
    Object.assign(notification, {
      targetType: ScheduleNotificationTargetType.Teacher,
      targetId: '17',
    });
    ystutyService.getTeacher.mockReturnValue(undefined);

    await service.deliver(notification, delivery, new Date('2026-09-01'));

    expect(ystutyService.getTeacher).toHaveBeenCalledWith(17);
    expect(transport.sendScheduleNotification).not.toHaveBeenCalled();
    expect(notification.lastError).toBe('Teacher is absent from Schedule API');
  });
});
