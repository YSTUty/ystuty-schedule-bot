export enum ScheduleNotifTargetType {
  Group = 'group',
  Teacher = 'teacher',
}

export enum ScheduleNotifDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum ScheduleNotifTargetDayOffset {
  Today = 0,
  Tomorrow = 1,
}

/** Определяет, приходит ли отдельный день или расписание текущей недели. */
export enum ScheduleNotifPeriod {
  Day = 'day',
  Week = 'week',
}

export type ScheduleNotifSettings = {
  deliveryHour: number;
  deliveryMinute: number;
  period: ScheduleNotifPeriod;
  /** Смещение используется только для рассылки отдельного дня. */
  targetDayOffset: ScheduleNotifTargetDayOffset | null;
  weekdays: number[];
};

/** Цель рассылки хранится отдельно от её времени и периодичности. */
export type ScheduleNotifTarget = {
  type: ScheduleNotifTargetType;
  id: string;
};
