import {
  Lesson,
  LessonFlags,
  OneWeek,
  WeekNumberType,
  WeekParityType,
} from '@my-interfaces';

import {
  appendScheduleTargetFooter,
  formatScheduleWeekDays,
} from './schedule-formatter.util';

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
  it('separates the schedule target from a weekly hashtag', () => {
    expect(appendScheduleTargetFooter('#НСуббота\n', 'САРД-25')).toBe(
      '#НСуббота\n\n[САРД-25]',
    );
  });

  it('formats schedule dates in Moscow timezone independently of the process timezone', () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = 'UTC';

    try {
      expect(format([lesson()])).toContain('(01.09.2026)');
      expect(
        format([lesson()], { targetType: 'group', presentation: 'detailed' }),
      ).toContain('Вторник · 1 сентября');
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    }
  });

  it('keeps the compact view concise and includes all lesson data', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-31T12:00:00+03:00'));

    try {
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
    } finally {
      jest.useRealTimers();
    }
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

  it('renders new Schedule API flags in compact and detailed presentations', () => {
    const flags = LessonFlags.PhysicalTraining | LessonFlags.School21;

    expect(format([lesson({ type: flags })])).toContain(
      '[Физ. культура, Школа 21]',
    );
    expect(
      format([lesson({ type: flags })], {
        targetType: 'group',
        presentation: 'detailed',
      }),
    ).toContain('🏫 Физ. культура · Школа 21');
  });

  it('keeps a valid API type when it is combined with Unsupported', () => {
    const result = format([
      lesson({ type: LessonFlags.Event | LessonFlags.Unsupported }),
    ]);

    expect(result).toContain('[Событие]');
    expect(result).not.toContain('N/A');
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

  it('collapses a large list of otherwise identical subgroup lessons in compact view', () => {
    const result = format(
      ['Иванов И. И.', 'Петров П. П.', 'Сидоров С. С.', 'Кузнецов К. К.'].map(
        (teacherName) =>
          lesson({
            number: 5,
            timeRange: '15:40-17:10',
            auditoryName: 'Точка кипения',
            lessonName: 'Научно-исследовательский семинар',
            teacherName,
            isDivision: teacherName !== 'Иванов И. И.',
          }),
      ),
    );

    expect(result).toContain('5⃣ 15:40-17:10. {Точка кипения}');
    expect(result).toContain('Научно-исследовательский семинар [ПР] П/Г');
    expect(result).toContain('👨‍🏫 Преподаватели:');
    expect(result).toContain('• Иванов И. И.');
    expect(result).toContain('• Кузнецов К. К.');
    expect(result).not.toContain('Другая П/Г:');
    expect(result?.match(/Научно-исследовательский семинар/g)).toHaveLength(1);
  });

  it('keeps different same-time lessons separate instead of treating them as subgroups', () => {
    const result = format([
      lesson({ number: 5, lessonName: 'Первый семинар' }),
      lesson({ number: 5, lessonName: 'Второй семинар' }),
      lesson({ number: 5, lessonName: 'Третий семинар' }),
      lesson({ number: 5, lessonName: 'Четвёртый семинар' }),
    ]);

    expect(result).toContain('Первый семинар');
    expect(result).toContain('Четвёртый семинар');
    expect(result).not.toContain('👨‍🏫');
  });

  it('does not collapse same-time lessons that differ only by new type flags', () => {
    const result = format(
      [
        LessonFlags.Practice,
        LessonFlags.Event,
        LessonFlags.Tenzor,
        LessonFlags.School21,
      ].map((type) =>
        lesson({
          number: 5,
          lessonName: 'Специальное занятие',
          teacherName: 'Иванов И. И.',
          type,
        }),
      ),
    );

    expect(result?.match(/Специальное занятие/g)).toHaveLength(4);
    expect(result).not.toContain('👨‍🏫 Преподаватели:');
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
