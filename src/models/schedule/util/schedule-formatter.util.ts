import { getLessonTypeStrArr } from '@my-common';
import { Lesson, LessonFlags, OneWeek, WeekNumberType } from '@my-interfaces';

import * as scheduleUtil from './schedule.util';

/** Вариант представления расписания в сообщении. */
export type SchedulePresentation = 'compact' | 'detailed';

type ScheduleFormatterOptions = {
  week: OneWeek;
  dayNumber?: WeekNumberType | null;
  addHashTag?: boolean;
  withTags?: boolean;
  targetType: 'group' | 'teacher';
  /** Передаётся тестами, чтобы проверка завершённых занятий была стабильной. */
  now?: Date;
};

const getLessonTime = (lesson: Lesson) =>
  lesson.timeRange || lesson.time || '—';

const getDate = (value?: string) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLessonTypes = (lesson: Lesson) =>
  getLessonTypeStrArr(lesson.type).filter(
    (type) => type !== 'N/A' && type !== '???',
  );

const getAuditories = (lesson: Lesson) =>
  [lesson.auditoryName, lesson.additionalAuditoryName]
    .filter((value): value is string => !!value?.trim())
    .join('; ');

const getTargets = (lesson: Lesson, targetType: 'group' | 'teacher') =>
  (targetType === 'group'
    ? [lesson.teacherName, lesson.additionalTeacherName]
    : lesson.groups
  )
    ?.filter((value): value is string => !!value?.trim())
    .join('; ') || '';

const getContinuationTime = (lesson: Lesson) => {
  const startTime = getLessonTime(lesson).split('-')[0];
  if (!/^\d{1,2}:\d{2}$/.test(startTime)) return null;

  const [hours, minutes] = startTime.split(':');
  return scheduleUtil.getTimez(
    `${hours}:${Number(minutes) + (lesson.number === 5 ? 110 : 100)}`,
  );
};

const withStrike = (value: string, isDone: boolean, withTags: boolean) =>
  isDone && withTags ? `<s>${value}</s>` : value;

const formatCompactLesson = ({
  lesson,
  isAnotherSubgroup,
  isDone,
  targetType,
  withTags,
}: {
  lesson: Lesson;
  isAnotherSubgroup: boolean;
  isDone: boolean;
  targetType: 'group' | 'teacher';
  withTags: boolean;
}) => {
  const auditoryName = getAuditories(lesson);
  const lessonTypes = getLessonTypes(lesson);
  const targets = getTargets(lesson, targetType);
  const lessonName = lesson.lessonName?.trim() || '—';
  const auditory = auditoryName
    ? withTags
      ? ` {<code>${auditoryName}</code>}`
      : ` {${auditoryName}}`
    : '';
  const type = lessonTypes.length
    ? withTags
      ? ` <b>[${lessonTypes.join(', ')}]</b>`
      : ` [${lessonTypes.join(', ')}]`
    : '';
  const distant = lesson.isDistant
    ? withTags
      ? ' <b>(онлайн)</b>'
      : ' (онлайн)'
    : '';
  const target = targets
    ? withTags
      ? ` (<i>${targets}</i>)`
      : ` (${targets})`
    : '';

  const prefix = isAnotherSubgroup
    ? 'Другая П/Г:'
    : `${scheduleUtil.getNumberEmoji(lesson.number)} ${withStrike(
        getLessonTime(lesson),
        isDone,
        withTags,
      )}.`;
  const division = lesson.isDivision ? ' П/Г' : '';

  return `${prefix}${auditory}${distant} ${lessonName}${type}${target}${division}${isDone ? ' ✅' : ''}`;
};

const formatDetailedLesson = ({
  lesson,
  isDone,
  targetType,
  withTags,
}: {
  lesson: Lesson;
  isDone: boolean;
  targetType: 'group' | 'teacher';
  withTags: boolean;
}) => {
  const auditoryName = getAuditories(lesson);
  const lessonDetails = [
    ...getLessonTypes(lesson),
    lesson.isDivision ? 'подгруппа' : '',
    lesson.isDistant ? 'онлайн' : '',
  ].filter(Boolean);
  const targets = getTargets(lesson, targetType);
  const lessonName = lesson.lessonName?.trim() || '—';
  const title = `${scheduleUtil.getNumberEmoji(lesson.number)} ${withStrike(
    getLessonTime(lesson),
    isDone,
    withTags,
  )}.${isDone ? ' ✅' : ''}`;
  const subject = withTags ? `<b>${lessonName}</b>` : lessonName;
  const auditory = auditoryName
    ? withTags
      ? `<code>${auditoryName}</code>`
      : auditoryName
    : '';
  const lessonDetail = lessonDetails.length ? lessonDetails.join(' · ') : '';
  const placeLine = [auditory, lessonDetail].filter(Boolean).join(' · ');
  const targetIcon = targetType === 'group' ? '👨‍🏫' : '👥';

  return [
    `${withTags ? `<b>${title}</b>` : title} ${subject}`,
    placeLine ? `   🏫 ${placeLine}` : '',
    targets ? `   ${targetIcon} ${targets}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

/** Формирует одно или несколько расписаний без вызовов API. */
export function formatScheduleWeekDays({
  week,
  dayNumber = null,
  addHashTag = false,
  withTags = false,
  targetType,
  now = new Date(),
  presentation = 'compact',
}: ScheduleFormatterOptions & {
  presentation?: SchedulePresentation;
}) {
  const fullWeek = dayNumber === null;
  const startDay = fullWeek ? WeekNumberType.Monday : dayNumber;
  const firstDay = week.days.find((day) => day.info.type === startDay);
  if (!fullWeek && !firstDay) return null;

  const days: string[] = [];
  for (let dayIndex = startDay; dayIndex < 7; ++dayIndex) {
    const day = week.days.find((item) => item.info.type === dayIndex);
    if (!day) {
      if (!fullWeek) break;
      continue;
    }

    const {
      info: { type: dayType, date: dayDateStr, weekNumber },
      lessons,
    } = day;
    const dayDate = getDate(dayDateStr);
    const isDoneDay =
      !!dayDate &&
      now.getTime() > dayDate.getTime() &&
      lessons.every(
        (lesson) =>
          !lesson.endAt || now.getTime() > new Date(lesson.endAt).getTime(),
      );
    const parity = weekNumber % 2 === 0 ? 'чётная' : 'нечётная';
    const compactParity = weekNumber % 2 === 0 ? 'Ч' : 'Н';
    const dayName = scheduleUtil.short2Long2(dayType, 2);

    let message =
      presentation === 'detailed'
        ? `${withTags ? '<b>' : ''}${scheduleUtil.short2Long2(dayType)} ${dayName}${withTags ? '</b>' : ''}${dayDate ? ` · ${dayDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}` : ''}\n${withTags ? '<i>' : ''}Неделя ${weekNumber} · ${parity}${withTags ? '</i>' : ''}\n\n`
        : `${scheduleUtil.short2Long2(dayType)} ${withTags ? '<b>Расписание на <code>' : 'Расписание на '}${dayName}${withTags ? '</code></b>' : ''}${weekNumber ? ` [${weekNumber}]` : ''}${dayDate ? (withTags ? ` <b>(${isDoneDay ? `<s>${dayDate.toLocaleDateString('ru-RU')}</s>` : dayDate.toLocaleDateString('ru-RU')})</b>` : ` (${dayDate.toLocaleDateString('ru-RU')})`) : ''}${isDoneDay ? ' ✅' : ''} ${compactParity}\n`;

    let lastLesson: Lesson | null = null;
    for (const [index, lesson] of lessons.entries()) {
      const nextLesson = lessons[index + 1];
      const isDone =
        !!lesson.endAt && now.getTime() > new Date(lesson.endAt).getTime();
      const isAnotherSubgroup =
        lastLesson?.number === lesson.number &&
        !(lesson.type & LessonFlags.Exam);

      if (
        presentation === 'compact' &&
        lastLesson &&
        lastLesson.number > 0 &&
        lastLesson.number < 3 &&
        lesson.number === 3
      ) {
        message += `✌ ${scheduleUtil.getTimez('11:40', 40)}. Окно\n`;
      }

      message +=
        presentation === 'detailed'
          ? `${formatDetailedLesson({ lesson, isDone, targetType, withTags })}\n`
          : `${formatCompactLesson({
              lesson,
              isAnotherSubgroup,
              isDone,
              targetType,
              withTags,
            })}\n`;

      // Длительную пару показываем один раз после всех её подгрупп.
      const sameNumberLessons = lessons.filter(
        (item) => item.number === lesson.number,
      );
      const extendedLesson = sameNumberLessons.find(
        (item) => item.duration > 2,
      );
      if (extendedLesson && nextLesson?.number !== lesson.number) {
        const continuationTime = getContinuationTime(extendedLesson);
        if (continuationTime) {
          const continuation = `${scheduleUtil.getNumberEmoji(lesson.number + 1)} ${withStrike(
            continuationTime,
            isDone,
            withTags,
          )}. Продолжение ${lesson.number} пары${isDone ? ' ✅' : ''}`;
          message +=
            presentation === 'detailed'
              ? `${continuation}\n`
              : `${continuation.replace(/\ Продолжение \d+ пары/, '')} ↑...\n`;
        }
      }
      lastLesson = lesson;
    }

    if (!lessons.length) {
      message +=
        presentation === 'detailed'
          ? withTags
            ? '<b>✌ Занятий нет</b>\n'
            : '✌ Занятий нет\n'
          : withTags
            ? '<b>✌ Занятий нет</b>\n'
            : '✌ Занятий нет\n';
    }

    if (addHashTag) {
      message += `#${compactParity}${scheduleUtil.short2Long2(dayType, 1)}\n`;
    }
    days.push(message.trimEnd());

    if (!fullWeek) break;
  }

  return days.join('\n\n');
}
