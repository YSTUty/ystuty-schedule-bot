import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';

import { SocialType } from '@my-common/constants';

import { ScheduleService } from '../../schedule/schedule.service';
import { UserSocial } from '../../user/entity/user-social.entity';
import {
  BroadcastAudienceFilter,
  BroadcastAudienceGroupsPreview,
} from '../broadcast.types';

@Injectable()
export class BroadcastAudienceFilterService {
  constructor(
    @InjectRepository(UserSocial)
    private readonly userSocialRepository: Repository<UserSocial>,
    private readonly scheduleService: ScheduleService,
  ) {}

  public normalizeFilter(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
  ): BroadcastAudienceFilter {
    const groupNames = filter.groupNames
      ? [...new Set(filter.groupNames)].sort((first, second) =>
          first.localeCompare(second, 'ru'),
        )
      : filter.groupName
        ? [filter.groupName]
        : undefined;

    return {
      hasDM: true,
      isBlockedBot: false,
      ...filter,
      ...(groupNames && { groupNames }),
      ...(social === SocialType.Vkontakte && { hasDM: filter.hasDM ?? true }),
    };
  }

  public async getRecipients(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
  ) {
    const normalized = this.normalizeFilter(social, filter);
    const where = this.buildWhere(social, normalized);

    return await this.userSocialRepository.find({
      where,
      order: { id: 'ASC' },
    });
  }

  public async getRecipientsPage(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
    page = 1,
    limit = 8,
  ) {
    const normalized = this.normalizeFilter(social, filter);
    const where = this.buildWhere(social, normalized);

    const safeLimit = Math.max(1, Math.min(limit, 20));
    const safePage = Math.max(1, page);
    const [items, total] = await this.userSocialRepository.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      items,
      total,
      currentPage: safePage,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      limit: safeLimit,
    };
  }

  /** Строит preview только по базовым условиям, чтобы показать кандидатов каждой группы. */
  public async getGroupsPreview(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
  ): Promise<BroadcastAudienceGroupsPreview> {
    const normalized = this.normalizeFilter(social, filter);
    const recipients = await this.userSocialRepository.find({
      where: this.buildWhere(social, {
        ...normalized,
        groupName: null,
        groupNames: undefined,
        userSocialIds: undefined,
      }),
      order: { id: 'ASC' },
    });
    const recipientsByGroup = new Map<string, number>();

    for (const recipient of recipients) {
      if (!recipient.groupName) continue;
      recipientsByGroup.set(
        recipient.groupName,
        (recipientsByGroup.get(recipient.groupName) || 0) + 1,
      );
    }

    const institutes = this.scheduleService
      .getGroupInstitutes([...recipientsByGroup.keys()])
      .map((institute) => ({
        instituteName: institute.name,
        groups: institute.groups.map((groupName) => ({
          groupName,
          recipientsCount: recipientsByGroup.get(groupName) || 0,
        })),
        recipientsCount: institute.groups.reduce(
          (count, groupName) => count + (recipientsByGroup.get(groupName) || 0),
          0,
        ),
      }));
    const selectedGroupNames = normalized.groupNames;
    const selectedRecipientsCount = selectedGroupNames
      ? selectedGroupNames.reduce(
          (count, groupName) => count + (recipientsByGroup.get(groupName) || 0),
          0,
        )
      : recipients.length;

    return {
      recipientsCount: recipients.length,
      selectedRecipientsCount,
      institutes,
    };
  }

  private buildWhere(
    social: SocialType,
    filter: BroadcastAudienceFilter,
  ): FindOptionsWhere<UserSocial> {
    const where: FindOptionsWhere<UserSocial> = { social };

    if (typeof filter.hasDM === 'boolean') where.hasDM = filter.hasDM;
    if (typeof filter.isBlockedBot === 'boolean') {
      where.isBlockedBot = filter.isBlockedBot;
    }
    if (filter.onlyAuthorized) {
      where.userId = Not(IsNull()) as unknown as number;
    }
    if (Array.isArray(filter.groupNames)) {
      where.groupName = In(filter.groupNames);
    } else if (filter.groupName) {
      where.groupName = filter.groupName;
    }
    if (filter.userSocialIds?.length) {
      where.id = In(filter.userSocialIds);
    }

    return where;
  }
}
