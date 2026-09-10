import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ScheduleNotifQueueService } from './schedule-notif-queue.service';
import { SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS } from './schedule-notif.constants';
import { ScheduleNotifService } from './schedule-notif.service';

const ISO_WEEKDAY_BY_NAME: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

@Injectable()
export class ScheduleNotifScheduler {
  private readonly logger = new Logger(ScheduleNotifScheduler.name);

  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly queueService: ScheduleNotifQueueService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  protected onCron() {
    this.run().catch((error) => {
      this.logger.error('Schedule notif batch failed', error.stack);
    });
  }

  /** Обрабатывает подписки, подходящие под переданную минуту */
  public async run(now = new Date()) {
    const { deliveryHour, deliveryMinute, isoWeekday } =
      this.getScheduleTimeParts(now);
    const scheduledFor = new Date(now);
    scheduledFor.setUTCSeconds(0, 0);

    const expiredDeliveries = await this.notifService.expirePendingDeliveries(
      new Date(scheduledFor.getTime() - SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS),
    );
    if (expiredDeliveries.affected) {
      this.logger.warn(
        `Expired ${expiredDeliveries.affected} schedule notif deliveries before queue processing`,
      );
    }
    const pendingDeliveries = await this.notifService.findPendingDeliveries({
      from: new Date(
        scheduledFor.getTime() - SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS,
      ),
      before: new Date(scheduledFor.getTime() - 1),
    });

    const notifs = await this.notifService.findDue({
      deliveryHour,
      deliveryMinute,
      isoWeekday,
    });
    const reservedDeliveries: {
      notif: (typeof notifs)[number];
      delivery: NonNullable<
        Awaited<ReturnType<ScheduleNotifService['reserveDelivery']>>
      >;
    }[] = [];
    for (const notif of notifs) {
      const delivery = await this.notifService.reserveDelivery(
        notif.id,
        scheduledFor,
      );
      if (delivery) {
        reservedDeliveries.push({ notif, delivery });
      }
    }
    const queueEntries = [
      ...pendingDeliveries.map((delivery) => ({
        notif: delivery.notif,
        delivery,
      })),
      ...reservedDeliveries,
    ];
    if (queueEntries.length) {
      await this.queueService.enqueueMany(queueEntries);
    }
  }

  private getScheduleTimeParts(now: Date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(now);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;

    const deliveryHour = Number(getPart('hour'));
    const deliveryMinute = Number(getPart('minute'));
    const weekday = getPart('weekday') as
      | keyof typeof ISO_WEEKDAY_BY_NAME
      | undefined;
    const isoWeekday = (weekday && ISO_WEEKDAY_BY_NAME[weekday]) || undefined;

    if (
      !Number.isInteger(deliveryHour) ||
      !Number.isInteger(deliveryMinute) ||
      isoWeekday === undefined
    ) {
      throw new Error('Unable to determine the Moscow notif minute');
    }

    return { deliveryHour, deliveryMinute, isoWeekday };
  }
}
