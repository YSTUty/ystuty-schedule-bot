import { Injectable } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { BroadcastAudienceFilter } from '../broadcast.types';

import { BroadcastAudienceFilterService } from './broadcast-audience-filter.service';

@Injectable()
export class BroadcastAudienceGroupFilterService {
  constructor(
    private readonly audienceFilterService: BroadcastAudienceFilterService,
  ) {}

  public async getInstitutesPage(params: {
    social: SocialType;
    filter: BroadcastAudienceFilter;
    page?: number;
    limit?: number;
  }) {
    const preview = await this.audienceFilterService.getGroupsPreview(
      params.social,
      params.filter,
    );
    const limit = Math.max(1, params.limit || 8);
    const totalPages = Math.max(
      1,
      Math.ceil(preview.institutes.length / limit),
    );
    const currentPage = Math.min(Math.max(1, params.page || 1), totalPages);

    return {
      ...preview,
      items: preview.institutes.slice(
        (currentPage - 1) * limit,
        currentPage * limit,
      ),
      currentPage,
      totalPages,
    };
  }

  public async getGroupsPage(params: {
    social: SocialType;
    filter: BroadcastAudienceFilter;
    instituteName: string;
    page?: number;
    limit?: number;
  }) {
    const preview = await this.audienceFilterService.getGroupsPreview(
      params.social,
      params.filter,
    );
    const institute = preview.institutes.find(
      (item) => item.instituteName === params.instituteName,
    );
    const limit = Math.max(1, params.limit || 8);
    const totalPages = Math.max(
      1,
      Math.ceil((institute?.groups.length || 0) / limit),
    );
    const currentPage = Math.min(Math.max(1, params.page || 1), totalPages);

    return {
      ...preview,
      institute,
      items:
        institute?.groups.slice(
          (currentPage - 1) * limit,
          currentPage * limit,
        ) || [],
      currentPage,
      totalPages,
    };
  }
}
