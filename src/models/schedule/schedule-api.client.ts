import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { firstValueFrom } from 'rxjs';

import type {
  ScheduleApiActualGroupsQueryDto,
  ScheduleApiActualGroupsResponseDto,
  ScheduleApiAudienceDto,
  ScheduleApiCountResponseDto,
  ScheduleApiGroupWeekResponseDto,
  ScheduleApiIdNameListResponseDto,
  ScheduleApiItemsResponseDto,
  ScheduleApiQueryOptionsDto,
  ScheduleApiRequestOptionsDto,
  ScheduleApiSemesterDto,
  ScheduleApiTeacherScheduleResponseDto,
} from './dto';
import type { ScheduleApi } from './schedule-api.interface';

/** HTTP-адаптер единого контракта Schedule API. */
@Injectable()
export class ScheduleApiClient implements ScheduleApi {
  constructor(private readonly httpService: HttpService) {}

  public async getCount(options?: ScheduleApiQueryOptionsDto) {
    return await this.get<ScheduleApiCountResponseDto>(
      '/v1/schedule/count',
      options,
    );
  }

  public async getActualGroups(options?: ScheduleApiActualGroupsQueryDto) {
    return await this.get<ScheduleApiActualGroupsResponseDto>(
      '/v1/schedule/actual_groups',
      options,
    );
  }

  public async getGroupSchedule(
    groupIdOrName: string,
    options?: ScheduleApiQueryOptionsDto,
  ) {
    return await this.get<ScheduleApiItemsResponseDto>(
      `/v1/schedule/group/${encodeURIComponent(groupIdOrName)}`,
      options,
    );
  }

  public async getGroupWeekSchedule(
    groupIdOrName: string,
    options?: ScheduleApiQueryOptionsDto,
  ) {
    return await this.get<ScheduleApiGroupWeekResponseDto>(
      `/v1/schedule/group_week/${encodeURIComponent(groupIdOrName)}`,
      options,
    );
  }

  public async getActualTeachers(options?: ScheduleApiQueryOptionsDto) {
    return await this.get<ScheduleApiIdNameListResponseDto>(
      '/v1/schedule/actual_teachers',
      options,
    );
  }

  public async getTeacherSchedule(
    teacherId: number,
    options?: ScheduleApiQueryOptionsDto,
  ) {
    return await this.get<ScheduleApiTeacherScheduleResponseDto>(
      `/v1/schedule/teacher/${teacherId}`,
      options,
    );
  }

  public async getActualAudiences(options?: ScheduleApiQueryOptionsDto) {
    return await this.get<ScheduleApiIdNameListResponseDto>(
      '/v1/schedule/actual_audiences',
      options,
    );
  }

  public async getAudienceSchedule(
    audienceIdOrName: string,
    options?: ScheduleApiQueryOptionsDto,
  ) {
    return await this.get<ScheduleApiItemsResponseDto>(
      `/v1/schedule/audience/${encodeURIComponent(audienceIdOrName)}`,
      options,
    );
  }

  public async getAllAudiences(options?: ScheduleApiRequestOptionsDto) {
    return await this.get<ScheduleApiAudienceDto[]>(
      '/v1/schedule/all_audiences',
      options,
    );
  }

  public async getAllSemesters(options?: ScheduleApiRequestOptionsDto) {
    return await this.get<ScheduleApiSemesterDto[]>(
      '/v1/schedule/all_semesters',
      options,
    );
  }

  /** Отделяет query Schedule API от локального timeout axios. */
  private async get<TResponse>(
    path: string,
    options?: ScheduleApiQueryOptionsDto | ScheduleApiRequestOptionsDto,
  ) {
    const { requestTimeoutMs, ...params } = options || {};
    const hasParams = Object.keys(params).length > 0;
    const { data } = await firstValueFrom(
      this.httpService.get<TResponse>(path, {
        ...(hasParams && { params }),
        ...(requestTimeoutMs !== undefined && { timeout: requestTimeoutMs }),
      }),
    );
    return data;
  }
}
