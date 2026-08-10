import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { YSTUtyService } from '../ystuty/ystuty.service';

import { ScheduleNotificationDelivery } from './entity/schedule-notification-delivery.entity';
import { ScheduleNotification } from './entity/schedule-notification.entity';
import {
  ScheduleNotificationDeliveryStatus,
  ScheduleNotificationTargetType,
} from './schedule-notification.types';
import { ScheduleNotificationTransportRegistry } from './transport/schedule-notification-transport.registry';

@Injectable()
export class ScheduleNotificationDeliveryService {
  constructor(
    @InjectRepository(ScheduleNotification)
    private readonly notificationRepository: Repository<ScheduleNotification>,
    @InjectRepository(ScheduleNotificationDelivery)
    private readonly deliveryRepository: Repository<ScheduleNotificationDelivery>,
    private readonly ystutyService: YSTUtyService,
    private readonly transportRegistry: ScheduleNotificationTransportRegistry,
  ) {}

  /** Формирует и отправляет один уже зарезервированный выпуск рассылки. */
  public async deliver(
    notification: ScheduleNotification,
    delivery: ScheduleNotificationDelivery,
  ) {
    try {
      const recipient = notification.userSocial;
      if (
        !notification.isEnabled ||
        !recipient?.hasDM ||
        recipient.isBlockedBot
      ) {
        return await this.markSkipped(
          notification,
          delivery,
          'Personal messages are unavailable',
        );
      }
      if (notification.targetType !== ScheduleNotificationTargetType.Group) {
        return await this.markSkipped(
          notification,
          delivery,
          'Unsupported notification target',
        );
      }

      const groupName = this.ystutyService.getGroupByName(
        notification.targetId,
      );
      if (!groupName) {
        return await this.markSkipped(
          notification,
          delivery,
          'Group is absent from Schedule API',
        );
      }

      const [, schedule] = await this.ystutyService.findNext({
        groupName,
        skipDays: notification.targetDayOffset,
      });
      const text = `${
        schedule || 'На этот день нету расписания'
      }\n[${groupName}]`;
      const transport = this.transportRegistry.get(notification.transport);
      const result = await transport.sendScheduleNotification({
        recipient,
        text,
      });

      Object.assign(delivery, {
        status: ScheduleNotificationDeliveryStatus.Sent,
        sentMessageId: result.messageId || null,
        error: null,
      });
      await this.deliveryRepository.save(delivery);
      await this.notificationRepository.save(
        Object.assign(notification, {
          lastDeliveredAt: new Date(),
          lastError: null,
        }),
      );
      return delivery;
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      Object.assign(delivery, {
        status: ScheduleNotificationDeliveryStatus.Failed,
        error: errorText,
      });
      await this.deliveryRepository.save(delivery);
      await this.notificationRepository.save(
        Object.assign(notification, {
          lastFailedAt: new Date(),
          lastError: errorText,
        }),
      );
      return delivery;
    }
  }

  private async markSkipped(
    notification: ScheduleNotification,
    delivery: ScheduleNotificationDelivery,
    error: string,
  ) {
    Object.assign(delivery, {
      status: ScheduleNotificationDeliveryStatus.Skipped,
      error,
    });
    await this.deliveryRepository.save(delivery);
    await this.notificationRepository.save(
      Object.assign(notification, {
        lastFailedAt: new Date(),
        lastError: error,
      }),
    );
    return delivery;
  }
}
