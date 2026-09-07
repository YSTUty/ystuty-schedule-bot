import {
  ScheduleNotifPeriod,
  ScheduleNotifSettings,
  ScheduleNotifTargetDayOffset,
} from './schedule-notif.types';

export { ScheduleNotifTargetDayOffset } from './schedule-notif.types';

/** Проверяет настройки доставки, допустимые для первого выпуска рассылки. */
export const assertScheduleNotifSettings = (
  settings: ScheduleNotifSettings,
) => {
  if (
    !Number.isInteger(settings.deliveryHour) ||
    settings.deliveryHour < 6 ||
    settings.deliveryHour > 23
  ) {
    throw new Error('deliveryHour must be an integer between 6 and 23');
  }

  if (
    !Number.isInteger(settings.deliveryMinute) ||
    settings.deliveryMinute < 0 ||
    settings.deliveryMinute > 50 ||
    settings.deliveryMinute % 10 !== 0
  ) {
    throw new Error('deliveryMinute must be a ten-minute interval');
  }

  if (!Object.values(ScheduleNotifPeriod).includes(settings.period)) {
    throw new Error('period must be day or week');
  }

  if (
    settings.period === ScheduleNotifPeriod.Day &&
    !Object.values(ScheduleNotifTargetDayOffset).includes(
      settings.targetDayOffset as ScheduleNotifTargetDayOffset,
    )
  ) {
    throw new Error('targetDayOffset must be today or tomorrow for day period');
  }

  if (
    settings.period === ScheduleNotifPeriod.Week &&
    settings.targetDayOffset !== null
  ) {
    throw new Error('targetDayOffset must be null for week period');
  }

  if (
    !settings.weekdays.length ||
    settings.weekdays.some(
      (weekday) => !Number.isInteger(weekday) || weekday < 1 || weekday > 7,
    ) ||
    new Set(settings.weekdays).size !== settings.weekdays.length
  ) {
    throw new Error('weekdays must contain unique ISO weekdays');
  }
};
