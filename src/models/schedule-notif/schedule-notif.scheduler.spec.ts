import { ScheduleNotifDeliveryService } from './schedule-notif-delivery.service';
import { ScheduleNotifScheduler } from './schedule-notif.scheduler';
import { ScheduleNotifService } from './schedule-notif.service';

describe('ScheduleNotifScheduler', () => {
  it('delivers only notifs due in the passed minute', async () => {
    const dueNotif = { id: 1 } as any;
    const delivery = { id: 1 } as any;
    const notifService = {
      findDue: jest.fn().mockResolvedValue([dueNotif]),
      reserveDelivery: jest.fn().mockResolvedValue(delivery),
    };
    const deliveryService = { deliver: jest.fn() };
    const scheduler = new ScheduleNotifScheduler(
      notifService as unknown as ScheduleNotifService,
      deliveryService as unknown as ScheduleNotifDeliveryService,
    );

    await scheduler.run(new Date('2026-09-07T17:00:00.000Z'));

    expect(notifService.findDue).toHaveBeenCalledWith({
      deliveryHour: 20,
      deliveryMinute: 0,
      isoWeekday: 1,
    });
    expect(notifService.reserveDelivery).toHaveBeenCalledWith(
      dueNotif.id,
      new Date('2026-09-07T17:00:00.000Z'),
    );
    expect(deliveryService.deliver).toHaveBeenCalledWith(
      dueNotif,
      delivery,
    );
  });

  it('does not deliver a notif that is already reserved', async () => {
    const notifService = {
      findDue: jest.fn().mockResolvedValue([{ id: 1 }]),
      reserveDelivery: jest.fn().mockResolvedValue(null),
    };
    const deliveryService = { deliver: jest.fn() };
    const scheduler = new ScheduleNotifScheduler(
      notifService as unknown as ScheduleNotifService,
      deliveryService as unknown as ScheduleNotifDeliveryService,
    );

    await scheduler.run(new Date('2026-09-07T17:00:00.000Z'));

    expect(deliveryService.deliver).not.toHaveBeenCalled();
  });
});
