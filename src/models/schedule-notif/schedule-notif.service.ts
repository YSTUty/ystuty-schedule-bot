import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserSocial } from '../user/entity/user-social.entity';
import { YSTUtyService } from '../ystuty/ystuty.service';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import {
  ScheduleNotifDeliveryStatus,
  ScheduleNotifSettings,
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
    private readonly ystutyService: YSTUtyService,
  ) {}

  /** Создаёт подписку на группу, выбранную в личном профиле пользователя. */
  public async createForUserSocial(
    userSocial: UserSocial,
    settings: ScheduleNotifSettings,
  ) {
    this.assertEligibleUserSocial(userSocial);
    assertScheduleNotifSettings(settings);
    const groupName = this.ystutyService.getGroupByName(userSocial.groupName);
    if (!groupName) {
      throw new Error('Selected group is absent from Schedule API');
    }

    return await this.notifRepository.save(
      this.notifRepository.create({
        userSocialId: userSocial.id,
        transport: userSocial.social,
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
  }

  /** Обновляет единственную подписку, которую пока создаёт пользовательский UI. */
  public async upsertFirstNotif(
    userSocial: UserSocial,
    settings: ScheduleNotifSettings,
  ) {
    this.assertEligibleUserSocial(userSocial);
    assertScheduleNotifSettings(settings);
    const groupName = this.ystutyService.getGroupByName(userSocial.groupName);
    if (!groupName) {
      throw new Error('Selected group is absent from Schedule API');
    }

    const notif = await this.notifRepository.findOne({
      where: { userSocialId: userSocial.id },
      order: { createdAt: 'DESC' },
    });
    if (!notif) {
      return await this.createForUserSocial(userSocial, settings);
    }

    Object.assign(notif, {
      ...settings,
      transport: userSocial.social,
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

  /** Меняет только цель рассылки, не затрагивая основную группу профиля. */
  public async changeGroup(
    userSocialId: number,
    notifId: number,
    groupName: string,
  ) {
    const selectedGroupName = this.ystutyService.getGroupByName(groupName);
    if (!selectedGroupName) {
      throw new Error('Selected group is absent from Schedule API');
    }
    const result = await this.notifRepository.update(
      {
        id: notifId,
        userSocialId,
        targetType: ScheduleNotifTargetType.Group,
      },
      {
        targetId: selectedGroupName,
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
    const notifs = await this.notifRepository.find({
      where: {
        isEnabled: true,
        deliveryHour: params.deliveryHour,
        deliveryMinute: params.deliveryMinute,
      },
      relations: ['userSocial'],
    });
    return notifs.filter((notif) =>
      notif.weekdays.includes(params.isoWeekday),
    );
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

  private assertEligibleUserSocial(userSocial: UserSocial) {
    if (!userSocial.hasDM) {
      throw new Error('Notifications are available only in personal messages');
    }
    if (userSocial.isBlockedBot) {
      throw new Error('Bot is blocked by this profile');
    }
    if (!userSocial.groupName) {
      throw new Error('Select a group before configuring notifs');
    }
  }
}
