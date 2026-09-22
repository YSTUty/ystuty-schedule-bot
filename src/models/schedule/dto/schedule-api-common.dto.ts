/** Общие типы контрактов Schedule API из docs/schedule.openapi.schema.yaml. */

export type ScheduleApiReferenceQueryDto = {
  /** Публичный идентификатор опубликованного семестра. */
  semesterId?: number;
};

/** Локальные параметры HTTP-вызова, которые не передаются в Schedule API. */
export type ScheduleApiRequestOptionsDto = {
  requestTimeoutMs?: number;
};

export type ScheduleApiQueryOptionsDto = ScheduleApiReferenceQueryDto &
  ScheduleApiRequestOptionsDto;

export type ScheduleApiCacheMetadataDto = {
  isCached: boolean;
  ttlSeconds?: number | null;
};

/** Legacy isCache сохранён в контракте для обратной совместимости с API. */
export type ScheduleApiCachedResponseDto = {
  /** @deprecated Используйте cache.isCached. */
  isCache: boolean;
  cache: ScheduleApiCacheMetadataDto;
};

export type ScheduleApiValidationErrorDto = {
  property: string;
  constraints: Record<string, string>;
};

export type ScheduleApiErrorDto = {
  code: number;
  message?: string | null;
  error: string;
  timestamp: string;
  payload?: Record<string, unknown> | null;
  validation?: ScheduleApiValidationErrorDto[] | null;
};

export type ScheduleApiErrorResponseDto = {
  error: ScheduleApiErrorDto;
};

export type ScheduleApiIdNameDto = {
  id: number;
  name: string;
};
