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

export type ScheduleNotifSettings = {
  deliveryHour: number;
  deliveryMinute: number;
  targetDayOffset: ScheduleNotifTargetDayOffset;
  weekdays: number[];
};
