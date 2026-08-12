import { SocialType } from '@my-common/constants';

import { UserSocial } from '../user/entity/user-social.entity';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import { ScheduleNotifDeliveryService } from './schedule-notif-delivery.service';
import {
  ScheduleNotifDeliveryStatus,
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
    const deliveryRepository = { save: jest.fn(async (value) => value) };
    const ystutyService = {
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
      ystutyService,
      transport,
      service: new ScheduleNotifDeliveryService(
        notifRepository as any,
        deliveryRepository as any,
        ystutyService as any,
        transportRegistry as any,
      ),
    };
  };

  beforeEach(() => {
    Object.assign(notif, {
      targetType: ScheduleNotifTargetType.Group,
      targetId: 'ЦИС-11',
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
    const { service, ystutyService, transport, deliveryRepository } =
      createService();
    ystutyService.getGroupByName.mockReturnValue(undefined);

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
    const { service, ystutyService, transport } = createService();
    ystutyService.getGroupByName.mockReturnValue('ЦИС-11');
    ystutyService.findNext.mockResolvedValue([1, '<b>Schedule</b>']);
    transport.sendScheduleNotif.mockResolvedValue({ messageId: '42' });

    await service.deliver(notif, delivery);

    expect(ystutyService.findNext).toHaveBeenCalledWith({
      groupName: 'ЦИС-11',
      skipDays: 1,
    });
    expect(delivery.status).toBe(ScheduleNotifDeliveryStatus.Sent);
    expect(delivery.sentMessageId).toBe('42');
  });

  it('delivers a conversation notif to its persistent messenger conversation id', async () => {
    const { service, ystutyService, transport } = createService();
    Object.assign(notif, {
      userSocial: null,
      conversation: { conversationId: -100123 },
    });
    ystutyService.getGroupByName.mockReturnValue('ЦИС-11');
    ystutyService.findNext.mockResolvedValue([1, '<b>Schedule</b>']);
    transport.sendScheduleNotif.mockResolvedValue({ messageId: '43' });

    await service.deliver(notif, delivery);

    expect(transport.sendScheduleNotif).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: { type: 'conversation', conversationId: -100123 },
      }),
    );
  });

  it('disables a notif and informs the recipient after the seventh missing target during the academic year', async () => {
    const { service, ystutyService, transport, notifRepository } =
      createService();
    notif.missingTargetAttempts = 6;
    ystutyService.getGroupByName.mockReturnValue(undefined);

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

  it('does not increase missing target attempts during summer', async () => {
    const { service, ystutyService, transport } = createService();
    notif.missingTargetAttempts = 6;
    ystutyService.getGroupByName.mockReturnValue(undefined);

    await service.deliver(notif, delivery, new Date('2026-07-01'));

    expect(notif).toMatchObject({
      isEnabled: true,
      missingTargetAttempts: 6,
    });
    expect(transport.sendScheduleNotif).not.toHaveBeenCalled();
  });

  it('checks a teacher target by identifier before delivery', async () => {
    const { service, ystutyService, transport } = createService();
    Object.assign(notif, {
      targetType: ScheduleNotifTargetType.Teacher,
      targetId: '17',
    });
    ystutyService.getTeacher.mockReturnValue(undefined);

    await service.deliver(notif, delivery, new Date('2026-09-01'));

    expect(ystutyService.getTeacher).toHaveBeenCalledWith(17);
    expect(transport.sendScheduleNotif).not.toHaveBeenCalled();
    expect(notif.lastError).toBe('Teacher is absent from Schedule API');
  });
});
