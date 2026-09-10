import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScheduleService } from '../schedule/schedule.service';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import {
  ScheduleNotifDeliveryStatus,
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
  ScheduleNotifTargetType,
} from './schedule-notif.types';
import { ScheduleNotifTransportRegistry } from './transport/schedule-notif-transport.registry';
import { type ScheduleNotifRecipient } from './transport/schedule-notif.transport';

@Injectable()
export class ScheduleNotifDeliveryService {
  private readonly logger = new Logger(ScheduleNotifDeliveryService.name);

  constructor(
    @InjectRepository(ScheduleNotif)
    private readonly notifRepository: Repository<ScheduleNotif>,
    @InjectRepository(ScheduleNotifDelivery)
    private readonly deliveryRepository: Repository<ScheduleNotifDelivery>,
    private readonly scheduleService: ScheduleService,
    private readonly transportRegistry: ScheduleNotifTransportRegistry,
  ) {}

  /** Формирует и отправляет один уже зарезервированный выпуск рассылки. */
  public async deliver(
    notif: ScheduleNotif,
    delivery: ScheduleNotifDelivery,
    now = new Date(),
  ) {
    const recipient: ScheduleNotifRecipient | undefined = notif.userSocial
      ? { type: 'user', userSocial: notif.userSocial }
      : notif.conversation
        ? {
            type: 'conversation',
            conversationId: Number(notif.conversation.conversationId),
          }
        : undefined;
    const unavailableReason = this.getUnavailableRecipientReason(
      notif,
      recipient,
    );
    if (unavailableReason) {
      return await this.markSkipped(notif, delivery, unavailableReason);
    }
    // getUnavailableRecipientReason() возвращает причину для отсутствующего
    // recipient, но явная проверка сохраняет narrowing для TypeScript.
    if (!recipient) {
      throw new Error('Schedule notification recipient is unavailable');
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

    const [, schedule] = await this.scheduleService.findNext({
      ...target.scheduleTarget,
      ...(notif.period === ScheduleNotifPeriod.Week
        ? { isWeek: true }
        : {
            // Старые записи без period остаются дневными до применения миграции.
            skipDays:
              notif.targetDayOffset ?? ScheduleNotifTargetDayOffset.Today,
          }),
    });
    const text = `${schedule || 'На этот день нету расписания'}\n[${target.name}]`;
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
  }

  /** Загружает актуальные relation перед выполнением job: настройки могли измениться после cron. */
  public async getPendingDeliveryForProcessing(deliveryId: number) {
    // Явные join-ы не дают TypeORM оставить recipient relation незагруженной
    // после повторного чтения delivery из Bull job.
    const delivery = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.notif', 'notif')
      .leftJoinAndSelect('notif.userSocial', 'userSocial')
      .leftJoinAndSelect('notif.conversation', 'conversation')
      .where('delivery.id = :deliveryId', { deliveryId })
      .andWhere('delivery.status = :status', {
        status: ScheduleNotifDeliveryStatus.Pending,
      })
      .getOne();
    if (!delivery?.notif) return null;
    return { notif: delivery.notif, delivery };
  }

  /** Сохраняет последнюю временную ошибку, не превращая доставку в final failure. */
  public async markRetry(delivery: ScheduleNotifDelivery, error: string) {
    Object.assign(delivery, {
      status: ScheduleNotifDeliveryStatus.Pending,
      error,
    });
    await this.deliveryRepository.save(delivery);
  }

  public async markFailed(
    notif: ScheduleNotif,
    delivery: ScheduleNotifDelivery,
    error: string,
    now = new Date(),
  ) {
    Object.assign(delivery, {
      status: ScheduleNotifDeliveryStatus.Failed,
      error,
    });
    await this.deliveryRepository.save(delivery);
    await this.notifRepository.save(
      Object.assign(notif, {
        lastFailedAt: now,
        lastError: error,
      }),
    );
    return delivery;
  }

  public async markSkipped(
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
    this.logger.warn(
      `Schedule notif delivery #${delivery.id} skipped: ${error}`,
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
        try {
          await transport.sendScheduleNotif({
            recipient,
            text: `Рассылка расписания автоматически отключена: ${error}. Выберите актуальную группу или преподавателя в настройках.`,
          });
        } catch (sendError) {
          this.logger.warn(
            `Could not notify about auto-disabled schedule notif #${notif.id}: ${
              sendError instanceof Error ? sendError.message : String(sendError)
            }`,
          );
        }
      }
    }
    return delivery;
  }

  /** Возвращает понятную причину, по которой получателю нельзя отправить уведомление. */
  private getUnavailableRecipientReason(
    notif: ScheduleNotif,
    recipient: ScheduleNotifRecipient | undefined,
  ) {
    if (!notif.isEnabled) return 'Notification is disabled';
    if (!recipient) {
      return notif.conversationId
        ? 'Conversation recipient relation is unavailable'
        : notif.userSocialId
          ? 'User recipient relation is unavailable'
          : 'Notification recipient is not configured';
    }
    if (notif.conversation?.isLeaved) {
      return 'Bot is no longer a member of the conversation';
    }
    if (recipient.type !== 'user') return null;
    if (!recipient.userSocial.hasDM) {
      return 'User has not allowed personal messages from the bot';
    }
    if (recipient.userSocial.isBlockedBot) return 'User blocked the bot';
    if (recipient.userSocial.broadcastDisabledAt) {
      return 'User disabled personal broadcasts';
    }
    return null;
  }

  /** Находит и нормализует цель рассылки для единого вызова Schedule API. */
  private getTarget(notif: ScheduleNotif) {
    if (notif.targetType === ScheduleNotifTargetType.Group) {
      const groupName = this.scheduleService.getGroupByName(notif.targetId);
      return groupName
        ? { name: groupName, scheduleTarget: { groupName } }
        : undefined;
    }
    if (notif.targetType === ScheduleNotifTargetType.Teacher) {
      const teacher = this.scheduleService.getTeacher(Number(notif.targetId));
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
