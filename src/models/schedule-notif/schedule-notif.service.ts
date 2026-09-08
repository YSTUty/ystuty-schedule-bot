import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOneOptions,
  IsNull,
  LessThan,
  Not,
  Repository,
} from 'typeorm';

import { MetricsService } from '../metrics/metrics.service';
import { ScheduleService } from '../schedule/schedule.service';
import { Conversation } from '../social/entity/conversation.entity';
import { UserSocial } from '../user/entity/user-social.entity';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import {
  CONVERSATION_SCHEDULE_NOTIF_LIMIT,
  PERSONAL_SCHEDULE_NOTIF_LIMIT,
} from './schedule-notif.constants';
import {
  ScheduleNotifDeliveryStatus,
  ScheduleNotifSettings,
  ScheduleNotifTarget,
  ScheduleNotifTargetType,
} from './schedule-notif.types';
import { assertScheduleNotifSettings } from './schedule-notif.validation';

@Injectable()
export class ScheduleNotifService {
  constructor(
    @InjectRepository(ScheduleNotif)
    private readonly notifRepository: Repository<ScheduleNotif>,
    @InjectRepository(ScheduleNotifDelivery)
    private readonly deliveryRepository: Repository<ScheduleNotifDelivery>,
    private readonly scheduleService: ScheduleService,
    private readonly metricsService: MetricsService,
  ) {}

  /** Создаёт личную подписку на уже выбранную группу или преподавателя. */
  public async createForUserSocial(
    userSocial: UserSocial,
    target: ScheduleNotifTarget,
    settings: ScheduleNotifSettings,
  ) {
    this.assertEligibleUserSocial(userSocial);
    await this.assertNotifLimit(
      { userSocialId: userSocial.id },
      PERSONAL_SCHEDULE_NOTIF_LIMIT,
    );
    assertScheduleNotifSettings(settings);
    const selectedTarget = this.getTarget(target);

    const notif = await this.notifRepository.save(
      this.notifRepository.create({
        userSocialId: userSocial.id,
        transport: userSocial.social,
        targetType: selectedTarget.type,
        targetId: selectedTarget.id,
        isEnabled: true,
        missingTargetAttempts: 0,
        lastDeliveredAt: null,
        lastFailedAt: null,
        lastError: null,
        ...settings,
      }),
    );
    this.metricsService.incrementScheduleNotifCreated({
      social: userSocial.social,
      scope: 'personal',
      targetType: selectedTarget.type,
      target: selectedTarget.id,
    });
    return notif;
  }

  /** Создаёт рассылку беседы для выбранной группы или преподавателя. */
  public async createForConversation(
    conversation: Conversation,
    target: ScheduleNotifTarget,
    settings: ScheduleNotifSettings,
  ) {
    await this.assertNotifLimit(
      { conversationId: conversation.id },
      CONVERSATION_SCHEDULE_NOTIF_LIMIT,
    );
    assertScheduleNotifSettings(settings);
    const selectedTarget = this.getTarget(target);

    const notif = await this.notifRepository.save(
      this.notifRepository.create({
        conversationId: conversation.id,
        userSocialId: null,
        transport: conversation.social,
        targetType: selectedTarget.type,
        targetId: selectedTarget.id,
        isEnabled: true,
        missingTargetAttempts: 0,
        lastDeliveredAt: null,
        lastFailedAt: null,
        lastError: null,
        ...settings,
      }),
    );
    this.metricsService.incrementScheduleNotifCreated({
      social: conversation.social,
      scope: 'conversation',
      targetType: selectedTarget.type,
      target: selectedTarget.id,
    });
    return notif;
  }

  /** Создаёт или обновляет единственную рассылку выбранной группы беседы. */
  public async upsertFirstConversationNotif(
    conversation: Conversation,
    settings: ScheduleNotifSettings,
  ) {
    assertScheduleNotifSettings(settings);
    const groupName = this.scheduleService.getGroupByName(
      conversation.groupName,
    );
    if (!groupName) {
      throw new Error(
        'Select a group for the conversation before configuring notifs',
      );
    }

    const notif = await this.getFirstConversationNotif(conversation.id);
    if (!notif) {
      const createdNotif = await this.notifRepository.save(
        this.notifRepository.create({
          conversationId: conversation.id,
          userSocialId: null,
          transport: conversation.social,
          targetType: ScheduleNotifTargetType.Group,
          targetId: groupName,
          isEnabled: true,
          missingTargetAttempts: 0,
          lastDeliveredAt: null,
          lastFailedAt: null,
          lastError: null,
          ...settings,
        }),
      );
      this.metricsService.incrementScheduleNotifCreated({
        social: conversation.social,
        scope: 'conversation',
        targetType: ScheduleNotifTargetType.Group,
        target: groupName,
      });
      return createdNotif;
    }

    Object.assign(notif, {
      ...settings,
      transport: conversation.social,
      targetType: ScheduleNotifTargetType.Group,
      targetId: groupName,
      isEnabled: true,
      lastError: null,
    });
    return await this.notifRepository.save(notif);
  }

  public async getFirstNotif(userSocialId: number) {
    return await this.notifRepository.findOne({
      where: { userSocialId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Возвращает все личные рассылки пользователя в порядке создания. */
  public async getNotifs(userSocialId: number) {
    return await this.notifRepository.find({
      where: { userSocialId },
      order: { createdAt: 'ASC' },
    });
  }

  public async getNotif(userSocialId: number, notifId: number) {
    return await this.notifRepository.findOne({
      where: { id: notifId, userSocialId },
    });
  }

  public async getFirstConversationNotif(conversationId: number) {
    return await this.notifRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Возвращает все настройки рассылки беседы в порядке создания. */
  public async getConversationNotifs(conversationId: number) {
    return await this.notifRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  public async getConversationNotif(conversationId: number, notifId: number) {
    return await this.notifRepository.findOne({
      where: { id: notifId, conversationId },
    });
  }

  public async setConversationEnabled(
    conversationId: number,
    notifId: number,
    isEnabled: boolean,
  ) {
    const result = await this.notifRepository.update(
      { id: notifId, conversationId },
      { isEnabled },
    );
    return result.affected === 1;
  }

  public async updateConversationSettings(
    conversationId: number,
    notifId: number,
    settings: ScheduleNotifSettings,
  ) {
    assertScheduleNotifSettings(settings);
    const result = await this.notifRepository.update(
      { id: notifId, conversationId },
      { ...settings, lastError: null },
    );
    return result.affected === 1;
  }

  public async deleteConversation(conversationId: number, notifId: number) {
    const result = await this.notifRepository.delete({
      id: notifId,
      conversationId,
    });
    return result.affected === 1;
  }

  /** Меняет цель рассылки беседы, не затрагивая её обычную выбранную группу. */
  public async changeConversationGroup(
    conversationId: number,
    notifId: number,
    groupName: string,
  ) {
    const selectedGroupName = this.scheduleService.getGroupByName(groupName);
    if (!selectedGroupName) {
      throw new Error('Selected group is absent from Schedule API');
    }
    const result = await this.notifRepository.update(
      {
        id: notifId,
        conversationId,
      },
      {
        targetType: ScheduleNotifTargetType.Group,
        targetId: selectedGroupName,
        lastError: null,
        missingTargetAttempts: 0,
      },
    );
    return result.affected === 1;
  }

  public async changeConversationTeacher(
    conversationId: number,
    notifId: number,
    teacherId: number,
  ) {
    const teacher = this.scheduleService.getTeacher(teacherId);
    if (!teacher) {
      throw new Error('Selected teacher is absent from Schedule API');
    }
    const result = await this.notifRepository.update(
      { id: notifId, conversationId },
      {
        targetType: ScheduleNotifTargetType.Teacher,
        targetId: String(teacher.id),
        lastError: null,
        missingTargetAttempts: 0,
      },
    );
    return result.affected === 1;
  }

  public async setEnabled(
    userSocialId: number,
    notifId: number,
    isEnabled: boolean,
  ) {
    const result = await this.notifRepository.update(
      { id: notifId, userSocialId },
      { isEnabled },
    );
    return result.affected === 1;
  }

  /** Обновляет параметры существующей рассылки, сохраняя её цель и статус. */
  public async updateSettings(
    userSocialId: number,
    notifId: number,
    settings: ScheduleNotifSettings,
  ) {
    assertScheduleNotifSettings(settings);
    const result = await this.notifRepository.update(
      { id: notifId, userSocialId },
      { ...settings, lastError: null },
    );
    return result.affected === 1;
  }

  public async delete(userSocialId: number, notifId: number) {
    const result = await this.notifRepository.delete({
      id: notifId,
      userSocialId,
    });
    return result.affected === 1;
  }

  /** Меняет цель рассылки, не затрагивая основную группу профиля. */
  public async changeGroup(
    userSocialId: number,
    notifId: number,
    groupName: string,
  ) {
    const selectedGroupName = this.scheduleService.getGroupByName(groupName);
    if (!selectedGroupName) {
      throw new Error('Selected group is absent from Schedule API');
    }
    const result = await this.notifRepository.update(
      {
        id: notifId,
        userSocialId,
      },
      {
        targetType: ScheduleNotifTargetType.Group,
        targetId: selectedGroupName,
        lastError: null,
        missingTargetAttempts: 0,
      },
    );
    return result.affected === 1;
  }

  public async changeTeacher(
    userSocialId: number,
    notifId: number,
    teacherId: number,
  ) {
    const teacher = this.scheduleService.getTeacher(teacherId);
    if (!teacher) {
      throw new Error('Selected teacher is absent from Schedule API');
    }
    const result = await this.notifRepository.update(
      { id: notifId, userSocialId },
      {
        targetType: ScheduleNotifTargetType.Teacher,
        targetId: String(teacher.id),
        lastError: null,
        missingTargetAttempts: 0,
      },
    );
    return result.affected === 1;
  }

  public async findDue(params: {
    deliveryHour: number;
    deliveryMinute: number;
    isoWeekday: number;
  }) {
    const where: FindOneOptions<ScheduleNotif>['where'] = {
      isEnabled: true,
      deliveryHour: params.deliveryHour,
      deliveryMinute: params.deliveryMinute,
    };
    const personalNotifs = await this.notifRepository.find({
      where: {
        ...where,
        userSocialId: Not(IsNull()),
      },
      relations: ['userSocial'],
    });
    const conversationNotifs = await this.notifRepository.find({
      where: {
        ...where,
        conversationId: Not(IsNull()),
      },
      relations: ['conversation'],
    });
    const notifs = [...personalNotifs, ...conversationNotifs];
    return notifs.filter((notif) => notif.weekdays.includes(params.isoWeekday));
  }

  /** Резервирует минуту отправки; конфликт уникальности означает уже обработанный cron. */
  public async reserveDelivery(notifId: number, scheduledFor: Date) {
    try {
      return await this.deliveryRepository.save(
        this.deliveryRepository.create({
          notifId,
          scheduledFor,
          status: ScheduleNotifDeliveryStatus.Pending,
          sentMessageId: null,
          error: null,
        }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return null;
      }
      throw error;
    }
  }

  /** Возвращает недавние pending-доставки для повторной постановки после сбоя Redis/Bull. */
  public async findPendingDeliveries(params: {
    from: Date;
    before: Date;
    limit?: number;
  }) {
    return await this.deliveryRepository.find({
      where: {
        status: ScheduleNotifDeliveryStatus.Pending,
        scheduledFor: Between(params.from, params.before),
      },
      relations: ['notif'],
      order: { scheduledFor: 'ASC' },
      take: params.limit || 500,
    });
  }

  /** Не отправляет устаревшее расписание, если очередь была недоступна слишком долго. */
  public async expirePendingDeliveries(before: Date) {
    await this.deliveryRepository.update(
      {
        status: ScheduleNotifDeliveryStatus.Pending,
        scheduledFor: LessThan(before),
      },
      {
        status: ScheduleNotifDeliveryStatus.Skipped,
        error: 'Notification delivery expired before it was sent',
      },
    );
  }

  private assertEligibleUserSocial(userSocial: UserSocial) {
    if (!userSocial.hasDM) {
      throw new Error('Notifications are available only in personal messages');
    }
    if (userSocial.isBlockedBot) {
      throw new Error('Bot is blocked by this profile');
    }
  }

  private async assertNotifLimit(
    where: { userSocialId?: number; conversationId?: number },
    limit: number,
  ) {
    const count = await this.notifRepository.count({ where });
    if (count >= limit) {
      throw new Error(`Schedule notification limit (${limit}) reached`);
    }
  }

  private getTarget(target: ScheduleNotifTarget): ScheduleNotifTarget {
    if (target.type === ScheduleNotifTargetType.Group) {
      const groupName = this.scheduleService.getGroupByName(target.id);
      if (!groupName) {
        throw new Error('Selected group is absent from Schedule API');
      }
      return { type: ScheduleNotifTargetType.Group, id: groupName };
    }

    const teacher = this.scheduleService.getTeacher(Number(target.id));
    if (!teacher) {
      throw new Error('Selected teacher is absent from Schedule API');
    }
    return { type: ScheduleNotifTargetType.Teacher, id: String(teacher.id) };
  }
}
