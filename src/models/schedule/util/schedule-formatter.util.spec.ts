import {
  Lesson,
  LessonFlags,
  OneWeek,
  WeekNumberType,
  WeekParityType,
} from '@my-interfaces';

import { formatScheduleWeekDays } from './schedule-formatter.util';

const lesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  number: 2,
  timeRange: '10:10-11:40',
  time: '',
  originalTimeTitle: '2. 10:10-11:40',
  parity: WeekParityType.ODD,
  type: LessonFlags.Practical,
  isStream: false,
  duration: 2,
  durationMinutes: 90,
  isDivision: false,
  lessonName: 'Адаптационная практика',
  ...overrides,
});

const week = (lessons: Lesson[] = []): OneWeek => ({
  number: 1,
  days: [
    {
      info: {
        type: WeekNumberType.Tuesday,
        date: '2026-09-01T00:00:00+03:00',
        weekNumber: 1,
      },
      lessons,
    },
  ],
});

const format = (
  lessons: Lesson[],
  options: Omit<Parameters<typeof formatScheduleWeekDays>[0], 'week'> = {
    targetType: 'group',
  },
) =>
  formatScheduleWeekDays({
    week: week(lessons),
    dayNumber: WeekNumberType.Tuesday,
    ...options,
  });

describe('formatScheduleWeekDays', () => {
  it('keeps the compact view concise and includes all lesson data', () => {
    const result = format([
      lesson({
        auditoryName: 'А-315',
        additionalAuditoryName: 'А-332',
        teacherName: 'Иванов И. И.',
        isDivision: true,
      }),
    ]);

    expect(result).toBe(
      '📗 Расписание на Вторник [1] (01.09.2026) Н\n' +
        '2⃣ 10:10-11:40. {А-315; А-332} Адаптационная практика [ПР] (Иванов И. И.) П/Г',
    );
  });

  it('renders the detailed view as separate readable lesson fields', () => {
    const result = format(
      [
        lesson({
          auditoryName: 'А-315',
          teacherName: 'Иванов И. И.',
          isDistant: true,
        }),
      ],
      { targetType: 'group', presentation: 'detailed' },
    );

    expect(result).toBe(
      '📗 Вторник · 1 сентября\n' +
        'Неделя 1 · нечётная\n\n' +
        '2⃣ 10:10-11:40. Адаптационная практика\n' +
        '   🏫 А-315 · ПР · онлайн\n' +
        '   👨‍🏫 Иванов И. И.',
    );
  });

  it('formats teacher schedules with groups instead of teacher names', () => {
    const result = format(
      [lesson({ groups: ['ЦИС-46', 'ЦИС-47'], teacherName: 'Не показывать' })],
      { targetType: 'teacher' },
    );

    expect(result).toContain('(ЦИС-46; ЦИС-47)');
    expect(result).not.toContain('Не показывать');
  });

  it('does not render null-like values or unsupported lesson type labels', () => {
    const result = format([
      lesson({
        lessonName: undefined,
        auditoryName: undefined,
        teacherName: undefined,
        type: LessonFlags.Unsupported,
      }),
    ]);

    expect(result).toContain(' —');
    expect(result).not.toMatch(/null|undefined|N\/A/);
  });

  it('renders a continuation once after all subgroups of a long lesson', () => {
    const result = format([
      lesson({
        number: 3,
        timeRange: '11:50-13:20',
        duration: 4,
        auditoryName: 'А-315',
      }),
      lesson({
        number: 3,
        timeRange: '11:50-13:20',
        duration: 4,
        auditoryName: 'А-332',
        isDivision: true,
        lessonName: 'Другая подгруппа',
      }),
    ]);

    expect(result).toContain('Другая П/Г: {А-332} Другая подгруппа');
    expect(result).toContain('4⃣ 13:30-15:00. ↑...');
    expect(result?.match(/↑\.\.\./g)).toHaveLength(1);
  });

  it('renders no-lesson days and week hashtags', () => {
    const result = formatScheduleWeekDays({
      week: week(),
      addHashTag: true,
      targetType: 'group',
    });

    expect(result).toContain('✌ Занятий нет');
    expect(result).toContain('#НВт');
  });

  it('preserves Telegram markup for the detailed variant', () => {
    const result = format([lesson({ teacherName: 'Иванов И. И.' })], {
      targetType: 'group',
      presentation: 'detailed',
      withTags: true,
    });

    expect(result).toContain('<b>📗 Вторник</b>');
    expect(result).toContain(
      '<b>2⃣ 10:10-11:40.</b> <b>Адаптационная практика</b>',
    );
    expect(result).toContain('   🏫 ПР');
    expect(result).toContain('   👨‍🏫 Иванов И. И.');
  });

  it('formats a detailed continuation as the next lesson number and time', () => {
    const result = format(
      [lesson({ number: 3, duration: 4, timeRange: '12:20-15:30' })],
      { targetType: 'group', presentation: 'detailed' },
    );

    expect(result).toContain('4⃣ 14:00-15:30. Продолжение 3 пары');
    expect(result).not.toContain('↳ Продолжение:');
  });

  it('does not add blank lines between detailed lessons', () => {
    const result = format([lesson({ number: 2 }), lesson({ number: 3 })], {
      targetType: 'group',
      presentation: 'detailed',
    });

    expect(result).not.toContain('Адаптационная практика\n\n3⃣');
  });
});
