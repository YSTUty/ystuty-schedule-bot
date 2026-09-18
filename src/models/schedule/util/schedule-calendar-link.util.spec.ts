import {
  getScheduleCalendarButtonUrl,
  getScheduleCalendarWebUrl,
} from './schedule-calendar-link.util';

describe('getScheduleCalendarWebUrl', () => {
  const calendarAddress = 'ics.ystuty.ru';

  it('builds a legacy calendar link for a group and a teacher', () => {
    expect(getScheduleCalendarWebUrl(['САР-34', 603], calendarAddress)).toBe(
      'https://ics.ystuty.ru/#САР-34,603',
    );
  });

  it('supports several group and teacher targets independently', () => {
    expect(
      getScheduleCalendarWebUrl(
        ['ЦИС 46', 603, 'Научно-исслед сем', 812],
        calendarAddress,
      ),
    ).toBe('https://ics.ystuty.ru/#ЦИС%2046,603,Научно-исслед%20сем,812');
  });

  it('keeps Cyrillic readable while escaping target separators and URL symbols', () => {
    expect(
      getScheduleCalendarWebUrl(['Группа (А), #1?'], calendarAddress),
    ).toBe('https://ics.ystuty.ru/#Группа%20(А)%2C%20%231%3F');
  });

  it('fully encodes every target for messenger URL buttons', () => {
    expect(getScheduleCalendarButtonUrl(['САР-34', 603], calendarAddress)).toBe(
      'https://ics.ystuty.ru/#%D0%A1%D0%90%D0%A0-34,603',
    );
  });

  it('omits empty and invalid targets', () => {
    expect(
      getScheduleCalendarWebUrl(['  ', 0, Number.NaN, null], calendarAddress),
    ).toBeNull();
  });

  it('requires the iCalendar website address to be configured', () => {
    expect(getScheduleCalendarWebUrl(['САР-34'], '')).toBeNull();
  });
});
