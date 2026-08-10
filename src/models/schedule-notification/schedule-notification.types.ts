export enum ScheduleNotificationTargetType {
  Group = 'group',
  Teacher = 'teacher',
}

export enum ScheduleNotificationDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum ScheduleNotificationTargetDayOffset {
  Today = 0,
  Tomorrow = 1,
}

export type ScheduleNotificationSettings = {
  deliveryHour: number;
  deliveryMinute: number;
  targetDayOffset: ScheduleNotificationTargetDayOffset;
  weekdays: number[];
};
