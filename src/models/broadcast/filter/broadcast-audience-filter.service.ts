import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindConditions, IsNull, Not, Repository } from 'typeorm';

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
    const where: FindConditions<UserSocial> = { social };

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

    return await this.userSocialRepository.find({
      where,
      order: { id: 'ASC' },
    });
  }
}
