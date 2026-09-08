import { ScheduleNotifQueueService } from './schedule-notif-queue.service';
import { SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS } from './schedule-notif.constants';
import { ScheduleNotifScheduler } from './schedule-notif.scheduler';
import { ScheduleNotifService } from './schedule-notif.service';

describe('ScheduleNotifScheduler', () => {
  it('queues only notifs due in the passed minute', async () => {
    const dueNotif = { id: 1 } as any;
    const delivery = { id: 1 } as any;
    const notifService = {
      findDue: jest.fn().mockResolvedValue([dueNotif]),
      reserveDelivery: jest.fn().mockResolvedValue(delivery),
      expirePendingDeliveries: jest.fn(),
      findPendingDeliveries: jest.fn().mockResolvedValue([]),
    };
    const queueService = { enqueueMany: jest.fn() };
    const scheduler = new ScheduleNotifScheduler(
      notifService as unknown as ScheduleNotifService,
      queueService as unknown as ScheduleNotifQueueService,
    );

    const now = new Date('2026-09-07T17:00:00.000Z');
    await scheduler.run(now);

    expect(notifService.findDue).toHaveBeenCalledWith({
      deliveryHour: 20,
      deliveryMinute: 0,
      isoWeekday: 1,
    });
    expect(notifService.reserveDelivery).toHaveBeenCalledWith(
      dueNotif.id,
      new Date('2026-09-07T17:00:00.000Z'),
    );
    expect(notifService.expirePendingDeliveries).toHaveBeenCalledWith(
      new Date(now.getTime() - SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS),
    );
    expect(notifService.findPendingDeliveries).toHaveBeenCalledWith({
      from: new Date(now.getTime() - SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS),
      before: new Date(now.getTime() - 1),
    });
    expect(queueService.enqueueMany).toHaveBeenCalledWith([
      { notif: dueNotif, delivery },
    ]);
  });

  it('does not queue a notif that is already reserved', async () => {
    const notifService = {
      findDue: jest.fn().mockResolvedValue([{ id: 1 }]),
      reserveDelivery: jest.fn().mockResolvedValue(null),
      expirePendingDeliveries: jest.fn(),
      findPendingDeliveries: jest.fn().mockResolvedValue([]),
    };
    const queueService = { enqueueMany: jest.fn() };
    const scheduler = new ScheduleNotifScheduler(
      notifService as unknown as ScheduleNotifService,
      queueService as unknown as ScheduleNotifQueueService,
    );

    await scheduler.run(new Date('2026-09-07T17:00:00.000Z'));

    expect(queueService.enqueueMany).not.toHaveBeenCalled();
  });

  it('requeues recent pending deliveries before reserving the current minute', async () => {
    const pendingDelivery = { id: 10, notif: { id: 4 } };
    const notifService = {
      findDue: jest.fn().mockResolvedValue([]),
      reserveDelivery: jest.fn(),
      expirePendingDeliveries: jest.fn(),
      findPendingDeliveries: jest.fn().mockResolvedValue([pendingDelivery]),
    };
    const queueService = { enqueueMany: jest.fn() };
    const scheduler = new ScheduleNotifScheduler(
      notifService as unknown as ScheduleNotifService,
      queueService as unknown as ScheduleNotifQueueService,
    );

    await scheduler.run(new Date('2026-09-07T17:00:00.000Z'));

    expect(queueService.enqueueMany).toHaveBeenCalledWith([
      { notif: pendingDelivery.notif, delivery: pendingDelivery },
    ]);
  });
});
