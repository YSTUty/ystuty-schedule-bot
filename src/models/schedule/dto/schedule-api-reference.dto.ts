import type {
  ScheduleApiCachedResponseDto,
  ScheduleApiIdNameDto,
  ScheduleApiReferenceQueryDto,
} from './schedule-api-common.dto';

export type ScheduleApiActualGroupsQueryDto = ScheduleApiReferenceQueryDto & {
  /** Возвращает детали групп вместо одних названий. */
  additional?: boolean;
};

export type ScheduleApiGroupDetailDto = {
  course: number;
  name: string;
  /** @deprecated Используйте groupId. */
  id_schedule?: number | null;
  groupId?: number | null;
  hasLecture: boolean;
  scheduleName: string;
};

export type ScheduleApiInstituteGroupsDto = {
  id?: number | null;
  name: string;
  groups: Array<string | ScheduleApiGroupDetailDto>;
};

export type ScheduleApiActualGroupsResponseDto =
  ScheduleApiCachedResponseDto & {
    /** @deprecated Название расписания не используется в новых интеграциях. */
    name?: string | null;
    items: ScheduleApiInstituteGroupsDto[];
  };

export type ScheduleApiIdNameListResponseDto = ScheduleApiCachedResponseDto & {
  items: ScheduleApiIdNameDto[];
  count: number;
};

export type ScheduleApiCountResponseDto = ScheduleApiCachedResponseDto & {
  institutes: number;
  groups: number;
  teachers: number;
  audiences: number;
};

export type ScheduleApiAudienceDto = {
  id: number;
  name?: string | null;
  kolvo?: number | null;
  buildingName?: string | null;
  sq?: number | null;
  date0?: string | null;
  date1?: string | null;
  note?: string | null;
  departmentShortName?: string | null;
  prsess?: number | null;
  floor?: number | null;
};

export type ScheduleApiAcademicYearSummaryDto = {
  id?: number | null;
  name?: string | null;
};

export type ScheduleApiSemesterSummaryDto = {
  id?: number | null;
  name?: string | null;
  number?: number | null;
};

export type ScheduleApiSemesterDto = {
  id: number;
  academicYear: ScheduleApiAcademicYearSummaryDto;
  semester: ScheduleApiSemesterSummaryDto;
  startsAt?: string | null;
  endsAt?: string | null;
  isPublished: boolean;
};
