import type { OneWeek, WeekNumberType } from '@my-interfaces';

import type {
  ScheduleApiCachedResponseDto,
  ScheduleApiIdNameDto,
} from './schedule-api-common.dto';

/** Обычное расписание группы или аудитории. */
export type ScheduleApiItemsResponseDto = ScheduleApiCachedResponseDto & {
  items: OneWeek[];
};

/** Расписание преподавателя содержит также его актуальные идентификатор и ФИО. */
export type ScheduleApiTeacherScheduleResponseDto =
  ScheduleApiItemsResponseDto & {
    teacher: ScheduleApiIdNameDto;
  };

export type ScheduleApiWeeklyLessonDto = {
  lessonNumber: number;
  trainingId: number;
  timeInterval: string;
  textz?: string | null;
  textz1?: string | null;
  weeks?: string | null;
  weeksDistant?: string | null;
  lessonName?: string | null;
  lessonTypeStr?: string | null;
  additionalInfo?: string | null;
  isShort: boolean;
  auditoryName?: string | null;
  fioprep?: string | null;
  wred?: string | null;
};

/** Представление group_week доступно только со scope schedule:advanced:read. */
export type ScheduleApiGroupWeekItemDto = {
  weekType: WeekNumberType;
  week: ScheduleApiWeeklyLessonDto[];
  isLecture: boolean;
};

export type ScheduleApiGroupWeekResponseDto = ScheduleApiCachedResponseDto & {
  items: ScheduleApiGroupWeekItemDto[];
};
