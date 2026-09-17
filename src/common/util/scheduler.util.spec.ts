import { LessonFlags } from '@my-interfaces';

import { getLessonTypeStrArr } from './scheduler.util';

describe('getLessonTypeStrArr', () => {
  it.each([
    [LessonFlags.Practice, 1 << 13, 'Практика'],
    [LessonFlags.Event, 1 << 14, 'Событие'],
    [LessonFlags.MilitaryTraining, 1 << 15, 'ВУЦ'],
    [LessonFlags.PhysicalTraining, 1 << 16, 'Физ. культура'],
    [LessonFlags.Elective, 1 << 17, 'Факультатив'],
    [LessonFlags.External, 1 << 18, 'Внешнее занятие'],
    [LessonFlags.Tenzor, 1 << 20, 'Тензор'],
    [LessonFlags.School21, 1 << 21, 'Школа 21'],
  ])('formats %s (%d) as %s', (flag, value, label) => {
    expect(flag).toBe(value);
    expect(getLessonTypeStrArr(flag)).toEqual([label]);
  });

  it('keeps every label when Schedule API combines new flags', () => {
    expect(
      getLessonTypeStrArr(
        LessonFlags.Practical |
          LessonFlags.Event |
          LessonFlags.Tenzor |
          LessonFlags.School21,
      ),
    ).toEqual(['ПР', 'Событие', 'Тензор', 'Школа 21']);
  });

  it('keeps an explicit fallback for a lesson without type flags', () => {
    expect(getLessonTypeStrArr(LessonFlags.None)).toEqual(['???']);
  });
});
