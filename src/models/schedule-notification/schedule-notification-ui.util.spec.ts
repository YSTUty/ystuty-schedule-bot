import {
  getWeekdaysLabel,
  parseWeekdays,
  toggleWeekday,
} from './schedule-notification-ui.util';

describe('schedule notification UI utilities', () => {
  it('keeps the final selected weekday when toggling it', () => {
    expect(toggleWeekday([1], 1)).toEqual([1]);
  });

  it('parses and orders valid weekday values only', () => {
    expect(parseWeekdays('7,2,invalid,0,8')).toEqual([2, 7]);
  });

  it('renders selected weekdays in Russian', () => {
    expect(getWeekdaysLabel([1, 3, 5])).toBe('Пн, Ср, Пт');
  });
});
