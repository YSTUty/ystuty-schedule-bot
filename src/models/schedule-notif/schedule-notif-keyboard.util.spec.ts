import { buildScheduleNotifPage } from './schedule-notif-keyboard.util';

describe('buildScheduleNotifPage', () => {
  it('splits a page into three columns and returns adjacent pages', () => {
    const page = buildScheduleNotifPage(
      Array.from({ length: 18 }, (_, index) => index + 6),
      2,
      6,
    );

    expect(page.rows).toEqual([
      [12, 13, 14],
      [15, 16, 17],
    ]);
    expect(page.currentPage).toBe(2);
    expect(page.totalPages).toBe(3);
    expect(page.previousPage).toBe(1);
    expect(page.nextPage).toBe(3);
  });
});
