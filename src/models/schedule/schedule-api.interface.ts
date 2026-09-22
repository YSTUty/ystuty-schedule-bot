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

/**
 * Интерфейс внешнего Schedule API.
 *
 * Новые возможности Schedule API добавляются сюда и в DTO, а не через
 * прямые HttpService-вызовы из transport или доменных сервисов.
 */
export interface ScheduleApi {
  getCount(
    options?: ScheduleApiQueryOptionsDto,
  ): Promise<ScheduleApiCountResponseDto>;
  getActualGroups(
    options?: ScheduleApiActualGroupsQueryDto,
  ): Promise<ScheduleApiActualGroupsResponseDto>;
  getGroupSchedule(
    groupIdOrName: string,
    options?: ScheduleApiQueryOptionsDto,
  ): Promise<ScheduleApiItemsResponseDto>;
  getGroupWeekSchedule(
    groupIdOrName: string,
    options?: ScheduleApiQueryOptionsDto,
  ): Promise<ScheduleApiGroupWeekResponseDto>;
  getActualTeachers(
    options?: ScheduleApiQueryOptionsDto,
  ): Promise<ScheduleApiIdNameListResponseDto>;
  getTeacherSchedule(
    teacherId: number,
    options?: ScheduleApiQueryOptionsDto,
  ): Promise<ScheduleApiTeacherScheduleResponseDto>;
  getActualAudiences(
    options?: ScheduleApiQueryOptionsDto,
  ): Promise<ScheduleApiIdNameListResponseDto>;
  getAudienceSchedule(
    audienceIdOrName: string,
    options?: ScheduleApiQueryOptionsDto,
  ): Promise<ScheduleApiItemsResponseDto>;
  getAllAudiences(
    options?: ScheduleApiRequestOptionsDto,
  ): Promise<ScheduleApiAudienceDto[]>;
  getAllSemesters(
    options?: ScheduleApiRequestOptionsDto,
  ): Promise<ScheduleApiSemesterDto[]>;
}
