import {
  formatScheduleTargetDate,
  getScheduleTargetDate,
  getScheduleWeekDateRange,
} from './schedule.util';

describe('schedule date labels', () => {
  it('uses the Moscow calendar day regardless of the process timezone', () => {
    const date = getScheduleTargetDate(1, new Date('2026-08-31T21:30:00.000Z'));

    expect(formatScheduleTargetDate(date)).toBe('2 сентября');
  });

  it('formats a week range with one shared month', () => {
    expect(
      getScheduleWeekDateRange(1, new Date('2026-09-07T09:00:00.000Z')),
    ).toBe('7–13 сентября');
  });

  it('keeps both months in a range across their boundary', () => {
    expect(
      getScheduleWeekDateRange(1, new Date('2026-08-30T09:00:00.000Z')),
    ).toBe('31 августа — 6 сентября');
  });
});
