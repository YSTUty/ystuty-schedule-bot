import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ScheduleNotificationDeliveryService } from './schedule-notification-delivery.service';
import { ScheduleNotificationService } from './schedule-notification.service';

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
export class ScheduleNotificationScheduler {
  private readonly logger = new Logger(ScheduleNotificationScheduler.name);

  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly deliveryService: ScheduleNotificationDeliveryService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  protected onCron() {
    this.run().catch((error) => {
      this.logger.error('Schedule notification batch failed', error.stack);
    });
  }

  /** Обрабатывает подписки, подходящие под переданную минуту */
  public async run(now = new Date()) {
    const { deliveryHour, deliveryMinute, isoWeekday } =
      this.getScheduleTimeParts(now);
    const scheduledFor = new Date(now);
    scheduledFor.setUTCSeconds(0, 0);

    const notifications = await this.notificationService.findDue({
      deliveryHour,
      deliveryMinute,
      isoWeekday,
    });
    for (const notification of notifications) {
      const delivery = await this.notificationService.reserveDelivery(
        notification.id,
        scheduledFor,
      );
      if (delivery) {
        await this.deliveryService.deliver(notification, delivery);
      }
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
      throw new Error('Unable to determine the Moscow notification minute');
    }

    return { deliveryHour, deliveryMinute, isoWeekday };
  }
}
