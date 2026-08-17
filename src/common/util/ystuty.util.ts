export const patternTeacherId = '(?<teacherId>[0-9]+)';

/** Русская команда открытия полного списка преподавателей. */
export const teacherListCommandRegExp = /^препод(?:ы|аватели)$/i;

/** Русская команда поиска преподавателя; query содержит введённые ФИО или фамилию. */
export const teacherSearchCommandRegExp =
  /^препод(?:аватель)?(?:\s+(?<query>.+))?$/i;

/** Slash-команда поиска преподавателя, сохранённая для Telegram и VK. */
export const teacherSearchSlashCommandRegExp =
  /^\/teacher(?:\s+(?<query>.+))?$/i;

/** Словесная команда личного расписания выбранного преподавателя на день. */
export const personalTeacherScheduleCommandRegExp =
  /^(?:расп|расписание)\s+препод(?:а|авател(?:я|ь))?$/i;

/** Словесная команда личного расписания выбранного преподавателя на неделю. */
export const personalTeacherWeekCommandRegExp =
  /^(?:расп|расписание)\s+препод(?:а|авател(?:я|ь))?\s+на\s+неделю$/i;

/** Проверяет, запрошено ли личное расписание преподавателя на день. */
export const isPersonalTeacherScheduleCommand = (text?: string) =>
  !!text && personalTeacherScheduleCommandRegExp.test(text.trim());

/** Проверяет, запрошено ли личное расписание преподавателя на неделю. */
export const isPersonalTeacherWeekCommand = (text?: string) =>
  !!text && personalTeacherWeekCommandRegExp.test(text.trim());

const patternGroupNameTemplate =
  '?<groupName>[А-я]{2,6}' +
  '(-|\\s)' +
  '([0-9]{1,2})' +
  '(\\(?[А-я]{1,2}\\)?)?' +
  '(\\s?\\(?[0-9А-я\\-]{1,7}\\)?)?';
export const patternGroupName = `(${patternGroupNameTemplate})`;
export const patternGroupName0 = `(${patternGroupNameTemplate}|0)`;

export const matchGroupName = (str: string, flags = 'i') =>
  str.match(new RegExp(patternGroupName, flags)) as
    | null
    | (RegExpMatchArray & { groups?: { groupName: string } });
