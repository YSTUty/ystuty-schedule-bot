import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserSocial } from '../user/entity/user-social.entity';
import { YSTUtyService } from '../ystuty/ystuty.service';

import { ScheduleNotificationDelivery } from './entity/schedule-notification-delivery.entity';
import { ScheduleNotification } from './entity/schedule-notification.entity';
import {
  ScheduleNotificationDeliveryStatus,
  ScheduleNotificationSettings,
  ScheduleNotificationTargetType,
} from './schedule-notification.types';
import { assertScheduleNotificationSettings } from './schedule-notification.validation';

@Injectable()
export class ScheduleNotificationService {
  constructor(
    @InjectRepository(ScheduleNotification)
    private readonly notificationRepository: Repository<ScheduleNotification>,
    @InjectRepository(ScheduleNotificationDelivery)
    private readonly deliveryRepository: Repository<ScheduleNotificationDelivery>,
    private readonly ystutyService: YSTUtyService,
  ) {}

  /** Создаёт подписку на группу, выбранную в личном профиле пользователя. */
  public async createForUserSocial(
    userSocial: UserSocial,
    settings: ScheduleNotificationSettings,
  ) {
    this.assertEligibleUserSocial(userSocial);
    assertScheduleNotificationSettings(settings);
    const groupName = this.ystutyService.getGroupByName(userSocial.groupName);
    if (!groupName) {
      throw new Error('Selected group is absent from Schedule API');
    }

    return await this.notificationRepository.save(
      this.notificationRepository.create({
        userSocialId: userSocial.id,
        transport: userSocial.social,
        targetType: ScheduleNotificationTargetType.Group,
        targetId: groupName,
        isEnabled: true,
        lastDeliveredAt: null,
        lastFailedAt: null,
        lastError: null,
        ...settings,
      }),
    );
  }

  /** Обновляет единственную подписку, которую пока создаёт пользовательский UI. */
  public async upsertFirstNotification(
    userSocial: UserSocial,
    settings: ScheduleNotificationSettings,
  ) {
    this.assertEligibleUserSocial(userSocial);
    assertScheduleNotificationSettings(settings);
    const groupName = this.ystutyService.getGroupByName(userSocial.groupName);
    if (!groupName) {
      throw new Error('Selected group is absent from Schedule API');
    }

    const notification = await this.notificationRepository.findOne({
      where: { userSocialId: userSocial.id },
      order: { createdAt: 'DESC' },
    });
    if (!notification) {
      return await this.createForUserSocial(userSocial, settings);
    }

    Object.assign(notification, {
      ...settings,
      transport: userSocial.social,
      targetType: ScheduleNotificationTargetType.Group,
      targetId: groupName,
      isEnabled: true,
      lastError: null,
    });
    return await this.notificationRepository.save(notification);
  }

  public async getFirstNotification(userSocialId: number) {
    return await this.notificationRepository.findOne({
      where: { userSocialId },
      order: { createdAt: 'DESC' },
    });
  }

  public async setEnabled(
    userSocialId: number,
    notificationId: number,
    isEnabled: boolean,
  ) {
    const result = await this.notificationRepository.update(
      { id: notificationId, userSocialId },
      { isEnabled },
    );
    return result.affected === 1;
  }

  /** Обновляет параметры существующей рассылки, сохраняя её цель и статус. */
  public async updateSettings(
    userSocialId: number,
    notificationId: number,
    settings: ScheduleNotificationSettings,
  ) {
    assertScheduleNotificationSettings(settings);
    const result = await this.notificationRepository.update(
      { id: notificationId, userSocialId },
      { ...settings, lastError: null },
    );
    return result.affected === 1;
  }

  public async delete(userSocialId: number, notificationId: number) {
    const result = await this.notificationRepository.delete({
      id: notificationId,
      userSocialId,
    });
    return result.affected === 1;
  }

  /** Меняет только цель рассылки, не затрагивая основную группу профиля. */
  public async changeGroup(
    userSocialId: number,
    notificationId: number,
    groupName: string,
  ) {
    const selectedGroupName = this.ystutyService.getGroupByName(groupName);
    if (!selectedGroupName) {
      throw new Error('Selected group is absent from Schedule API');
    }
    const result = await this.notificationRepository.update(
      {
        id: notificationId,
        userSocialId,
        targetType: ScheduleNotificationTargetType.Group,
      },
      { targetId: selectedGroupName, lastError: null },
    );
    return result.affected === 1;
  }

  public async findDue(params: {
    deliveryHour: number;
    deliveryMinute: number;
    isoWeekday: number;
  }) {
    const notifications = await this.notificationRepository.find({
      where: {
        isEnabled: true,
        deliveryHour: params.deliveryHour,
        deliveryMinute: params.deliveryMinute,
      },
      relations: ['userSocial'],
    });
    return notifications.filter((notification) =>
      notification.weekdays.includes(params.isoWeekday),
    );
  }

  /** Резервирует минуту отправки; конфликт уникальности означает уже обработанный cron. */
  public async reserveDelivery(notificationId: number, scheduledFor: Date) {
    try {
      return await this.deliveryRepository.save(
        this.deliveryRepository.create({
          notificationId,
          scheduledFor,
          status: ScheduleNotificationDeliveryStatus.Pending,
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

  private assertEligibleUserSocial(userSocial: UserSocial) {
    if (!userSocial.hasDM) {
      throw new Error('Notifications are available only in personal messages');
    }
    if (userSocial.isBlockedBot) {
      throw new Error('Bot is blocked by this profile');
    }
    if (!userSocial.groupName) {
      throw new Error('Select a group before configuring notifications');
    }
  }
}
