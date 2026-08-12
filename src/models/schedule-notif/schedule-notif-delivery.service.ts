import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { YSTUtyService } from '../ystuty/ystuty.service';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import {
  ScheduleNotifDeliveryStatus,
  ScheduleNotifTargetType,
} from './schedule-notif.types';
import { ScheduleNotifTransportRegistry } from './transport/schedule-notif-transport.registry';
import { type ScheduleNotifRecipient } from './transport/schedule-notif.transport';

@Injectable()
export class ScheduleNotifDeliveryService {
  constructor(
    @InjectRepository(ScheduleNotif)
    private readonly notifRepository: Repository<ScheduleNotif>,
    @InjectRepository(ScheduleNotifDelivery)
    private readonly deliveryRepository: Repository<ScheduleNotifDelivery>,
    private readonly ystutyService: YSTUtyService,
    private readonly transportRegistry: ScheduleNotifTransportRegistry,
  ) {}

  /** Формирует и отправляет один уже зарезервированный выпуск рассылки. */
  public async deliver(
    notif: ScheduleNotif,
    delivery: ScheduleNotifDelivery,
    now = new Date(),
  ) {
    try {
      const recipient: ScheduleNotifRecipient | undefined = notif.userSocial
        ? { type: 'user', userSocial: notif.userSocial }
        : notif.conversation
          ? {
              type: 'conversation',
              conversationId: Number(notif.conversation.conversationId),
            }
          : undefined;
      if (
        !notif.isEnabled ||
        !recipient ||
        (recipient.type === 'user' &&
          (!recipient.userSocial.hasDM || recipient.userSocial.isBlockedBot))
      ) {
        return await this.markSkipped(
          notif,
          delivery,
          'Notification recipient is unavailable',
        );
      }
      const target = this.getTarget(notif);
      if (!target) {
        return await this.markSkipped(
          notif,
          delivery,
          `${
            notif.targetType === ScheduleNotifTargetType.Group
              ? 'Group'
              : 'Teacher'
          } is absent from Schedule API`,
          now,
          true,
        );
      }

      const [, schedule] = await this.ystutyService.findNext({
        ...target.scheduleTarget,
        skipDays: notif.targetDayOffset,
      });
      const text = `${
        schedule || 'На этот день нету расписания'
      }\n[${target.name}]`;
      const transport = this.transportRegistry.get(notif.transport);
      const result = await transport.sendScheduleNotif({
        recipient,
        text,
      });

      Object.assign(delivery, {
        status: ScheduleNotifDeliveryStatus.Sent,
        sentMessageId: result.messageId || null,
        error: null,
      });
      await this.deliveryRepository.save(delivery);
      await this.notifRepository.save(
        Object.assign(notif, {
          lastDeliveredAt: new Date(),
          lastError: null,
        }),
      );
      return delivery;
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      Object.assign(delivery, {
        status: ScheduleNotifDeliveryStatus.Failed,
        error: errorText,
      });
      await this.deliveryRepository.save(delivery);
      await this.notifRepository.save(
        Object.assign(notif, {
          lastFailedAt: new Date(),
          lastError: errorText,
        }),
      );
      return delivery;
    }
  }

  private async markSkipped(
    notif: ScheduleNotif,
    delivery: ScheduleNotifDelivery,
    error: string,
    now = new Date(),
    isMissingTarget = false,
  ) {
    Object.assign(delivery, {
      status: ScheduleNotifDeliveryStatus.Skipped,
      error,
    });
    await this.deliveryRepository.save(delivery);
    const missingTargetAttempts =
      isMissingTarget && this.isAcademicYearMonth(now)
        ? (notif.missingTargetAttempts || 0) + 1
        : notif.missingTargetAttempts || 0;
    const isDeactivated = missingTargetAttempts >= 7;
    await this.notifRepository.save(
      Object.assign(notif, {
        isEnabled: isDeactivated ? false : notif.isEnabled,
        missingTargetAttempts,
        lastFailedAt: now,
        lastError: error,
      }),
    );
    if (isDeactivated) {
      const recipient: ScheduleNotifRecipient | undefined = notif.userSocial
        ? { type: 'user', userSocial: notif.userSocial }
        : notif.conversation
          ? {
              type: 'conversation',
              conversationId: Number(notif.conversation.conversationId),
            }
          : undefined;
      if (recipient) {
        const transport = this.transportRegistry.get(notif.transport);
        await transport.sendScheduleNotif({
          recipient,
          text: `Рассылка расписания автоматически отключена: ${error}. Выберите актуальную группу или преподавателя в настройках.`,
        });
      }
    }
    return delivery;
  }

  /** Находит и нормализует цель рассылки для единого вызова Schedule API. */
  private getTarget(notif: ScheduleNotif) {
    if (notif.targetType === ScheduleNotifTargetType.Group) {
      const groupName = this.ystutyService.getGroupByName(notif.targetId);
      return groupName
        ? { name: groupName, scheduleTarget: { groupName } }
        : undefined;
    }
    if (notif.targetType === ScheduleNotifTargetType.Teacher) {
      const teacher = this.ystutyService.getTeacher(Number(notif.targetId));
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
