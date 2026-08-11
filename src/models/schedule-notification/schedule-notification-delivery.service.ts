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
    now = new Date(),
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
      const target = this.getTarget(notification);
      if (!target) {
        return await this.markSkipped(
          notification,
          delivery,
          `${
            notification.targetType === ScheduleNotificationTargetType.Group
              ? 'Group'
              : 'Teacher'
          } is absent from Schedule API`,
          now,
          true,
        );
      }

      const [, schedule] = await this.ystutyService.findNext({
        ...target.scheduleTarget,
        skipDays: notification.targetDayOffset,
      });
      const text = `${
        schedule || 'На этот день нету расписания'
      }\n[${target.name}]`;
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
    now = new Date(),
    isMissingTarget = false,
  ) {
    Object.assign(delivery, {
      status: ScheduleNotificationDeliveryStatus.Skipped,
      error,
    });
    await this.deliveryRepository.save(delivery);
    const missingTargetAttempts =
      isMissingTarget && this.isAcademicYearMonth(now)
        ? (notification.missingTargetAttempts || 0) + 1
        : notification.missingTargetAttempts || 0;
    const isDeactivated = missingTargetAttempts >= 7;
    await this.notificationRepository.save(
      Object.assign(notification, {
        isEnabled: isDeactivated ? false : notification.isEnabled,
        missingTargetAttempts,
        lastFailedAt: now,
        lastError: error,
      }),
    );
    if (isDeactivated) {
      const transport = this.transportRegistry.get(notification.transport);
      await transport.sendMessage({
        recipient: notification.userSocial,
        text: `Рассылка расписания автоматически отключена: ${error}. Выберите актуальную группу или преподавателя в настройках.`,
      });
    }
    return delivery;
  }

  /** Находит и нормализует цель рассылки для единого вызова Schedule API. */
  private getTarget(notification: ScheduleNotification) {
    if (notification.targetType === ScheduleNotificationTargetType.Group) {
      const groupName = this.ystutyService.getGroupByName(notification.targetId);
      return groupName
        ? { name: groupName, scheduleTarget: { groupName } }
        : undefined;
    }
    if (notification.targetType === ScheduleNotificationTargetType.Teacher) {
      const teacher = this.ystutyService.getTeacher(Number(notification.targetId));
      return teacher
        ? {
            name: teacher.name,
            scheduleTarget: { teacherId: teacher.id },
          }
        : undefined;
    }
    return undefined;
  }

  /** В июле и августе не проверяем исчезновение цели: списки API могут быть неполными. */
  private isAcademicYearMonth(now: Date) {
    const month = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Moscow',
        month: 'numeric',
      }).format(now),
    );
    return month < 7 || month > 8;
  }
}
