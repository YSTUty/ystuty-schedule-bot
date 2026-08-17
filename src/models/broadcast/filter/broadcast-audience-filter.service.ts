import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';

import { SocialType } from '@my-common/constants';

import { UserSocial } from '../../user/entity/user-social.entity';
import { BroadcastAudienceFilter } from '../broadcast.types';

@Injectable()
export class BroadcastAudienceFilterService {
  constructor(
    @InjectRepository(UserSocial)
    private readonly userSocialRepository: Repository<UserSocial>,
  ) {}

  public normalizeFilter(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
  ): BroadcastAudienceFilter {
    return {
      hasDM: true,
      isBlockedBot: false,
      ...filter,
      ...(social === SocialType.Vkontakte && { hasDM: filter.hasDM ?? true }),
    };
  }

  public async getRecipients(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
  ) {
    const normalized = this.normalizeFilter(social, filter);
    const where: FindOptionsWhere<UserSocial> = { social };

    if (typeof normalized.hasDM === 'boolean') {
      where.hasDM = normalized.hasDM;
    }
    if (typeof normalized.isBlockedBot === 'boolean') {
      where.isBlockedBot = normalized.isBlockedBot;
    }
    if (normalized.onlyAuthorized) {
      where.userId = Not(IsNull()) as unknown as number;
    }
    if (normalized.groupName) {
      where.groupName = normalized.groupName;
    }
    if (normalized.userSocialIds?.length) {
      where.id = In(normalized.userSocialIds);
    }

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
    const where: FindOptionsWhere<UserSocial> = { social };

    if (typeof normalized.hasDM === 'boolean') {
      where.hasDM = normalized.hasDM;
    }
    if (typeof normalized.isBlockedBot === 'boolean') {
      where.isBlockedBot = normalized.isBlockedBot;
    }
    if (normalized.onlyAuthorized) {
      where.userId = Not(IsNull()) as unknown as number;
    }
    if (normalized.groupName) {
      where.groupName = normalized.groupName;
    }

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
}
