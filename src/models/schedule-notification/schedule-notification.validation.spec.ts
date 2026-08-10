import {
  assertScheduleNotificationSettings,
  ScheduleNotificationTargetDayOffset,
} from './schedule-notification.validation';

describe('assertScheduleNotificationSettings', () => {
  it('accepts an hourly Moscow-time notification with distinct ISO weekdays', () => {
    expect(() =>
      assertScheduleNotificationSettings({
        deliveryHour: 20,
        deliveryMinute: 0,
        targetDayOffset: ScheduleNotificationTargetDayOffset.Tomorrow,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      }),
    ).not.toThrow();
  });

  it.each([[5], [24]])('rejects an hour outside 06:00–23:00: %d', (hour) => {
    expect(() =>
      assertScheduleNotificationSettings({
        deliveryHour: hour,
        deliveryMinute: 0,
        targetDayOffset: ScheduleNotificationTargetDayOffset.Today,
        weekdays: [1],
      }),
    ).toThrow('deliveryHour');
  });

  it('rejects duplicate weekdays', () => {
    expect(() =>
      assertScheduleNotificationSettings({
        deliveryHour: 10,
        deliveryMinute: 0,
        targetDayOffset: ScheduleNotificationTargetDayOffset.Today,
        weekdays: [1, 1],
      }),
    ).toThrow('weekdays');
  });

  it('rejects a minute outside ten-minute intervals', () => {
    expect(() =>
      assertScheduleNotificationSettings({
        deliveryHour: 10,
        deliveryMinute: 15,
        targetDayOffset: ScheduleNotificationTargetDayOffset.Today,
        weekdays: [1],
      }),
    ).toThrow('deliveryMinute');
  });
});
