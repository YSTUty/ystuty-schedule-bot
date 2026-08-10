import { ScheduleNotificationDeliveryService } from './schedule-notification-delivery.service';
import { ScheduleNotificationScheduler } from './schedule-notification.scheduler';
import { ScheduleNotificationService } from './schedule-notification.service';

describe('ScheduleNotificationScheduler', () => {
  it('delivers only notifications due in the passed minute', async () => {
    const dueNotification = { id: 1 } as any;
    const delivery = { id: 1 } as any;
    const notificationService = {
      findDue: jest.fn().mockResolvedValue([dueNotification]),
      reserveDelivery: jest.fn().mockResolvedValue(delivery),
    };
    const deliveryService = { deliver: jest.fn() };
    const scheduler = new ScheduleNotificationScheduler(
      notificationService as unknown as ScheduleNotificationService,
      deliveryService as unknown as ScheduleNotificationDeliveryService,
    );

    await scheduler.run(new Date('2026-09-07T17:00:00.000Z'));

    expect(notificationService.findDue).toHaveBeenCalledWith({
      deliveryHour: 20,
      deliveryMinute: 0,
      isoWeekday: 1,
    });
    expect(notificationService.reserveDelivery).toHaveBeenCalledWith(
      dueNotification.id,
      new Date('2026-09-07T17:00:00.000Z'),
    );
    expect(deliveryService.deliver).toHaveBeenCalledWith(
      dueNotification,
      delivery,
    );
  });

  it('does not deliver a notification that is already reserved', async () => {
    const notificationService = {
      findDue: jest.fn().mockResolvedValue([{ id: 1 }]),
      reserveDelivery: jest.fn().mockResolvedValue(null),
    };
    const deliveryService = { deliver: jest.fn() };
    const scheduler = new ScheduleNotificationScheduler(
      notificationService as unknown as ScheduleNotificationService,
      deliveryService as unknown as ScheduleNotificationDeliveryService,
    );

    await scheduler.run(new Date('2026-09-07T17:00:00.000Z'));

    expect(deliveryService.deliver).not.toHaveBeenCalled();
  });
});
