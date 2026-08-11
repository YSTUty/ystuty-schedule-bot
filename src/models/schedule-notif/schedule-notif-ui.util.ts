export const SCHEDULE_NOTIFICATION_MINUTES = [0, 10, 20, 30, 40, 50] as const;

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Переключает день недели, не оставляя настройку без единственного дня. */
export const toggleWeekday = (weekdays: number[], weekday: number) =>
  weekdays.includes(weekday)
    ? weekdays.length === 1
      ? weekdays
      : weekdays.filter((item) => item !== weekday)
    : [...weekdays, weekday].sort((first, second) => first - second);

/** Принимает строку callback Telegram или массив callback VK. */
export const parseWeekdays = (input: unknown) => {
  const values = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  return [...new Set(values.map(Number))]
    .filter(
      (weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7,
    )
    .sort((first, second) => first - second);
};

/** Возвращает локализованную краткую подпись выбранных дней. */
export const getWeekdaysLabel = (weekdays: number[]) =>
  weekdays
    .map((weekday) => WEEKDAY_LABELS[weekday - 1])
    .filter(Boolean)
    .join(', ');
