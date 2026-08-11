import {
  assertScheduleNotifSettings,
  ScheduleNotifTargetDayOffset,
} from './schedule-notif.validation';

describe('assertScheduleNotifSettings', () => {
  it('accepts an hourly Moscow-time notif with distinct ISO weekdays', () => {
    expect(() =>
      assertScheduleNotifSettings({
        deliveryHour: 20,
        deliveryMinute: 0,
        targetDayOffset: ScheduleNotifTargetDayOffset.Tomorrow,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      }),
    ).not.toThrow();
  });

  it.each([[5], [24]])('rejects an hour outside 06:00–23:00: %d', (hour) => {
    expect(() =>
      assertScheduleNotifSettings({
        deliveryHour: hour,
        deliveryMinute: 0,
        targetDayOffset: ScheduleNotifTargetDayOffset.Today,
        weekdays: [1],
      }),
    ).toThrow('deliveryHour');
  });

  it('rejects duplicate weekdays', () => {
    expect(() =>
      assertScheduleNotifSettings({
        deliveryHour: 10,
        deliveryMinute: 0,
        targetDayOffset: ScheduleNotifTargetDayOffset.Today,
        weekdays: [1, 1],
      }),
    ).toThrow('weekdays');
  });

  it('rejects a minute outside ten-minute intervals', () => {
    expect(() =>
      assertScheduleNotifSettings({
        deliveryHour: 10,
        deliveryMinute: 15,
        targetDayOffset: ScheduleNotifTargetDayOffset.Today,
        weekdays: [1],
      }),
    ).toThrow('deliveryMinute');
  });
});
