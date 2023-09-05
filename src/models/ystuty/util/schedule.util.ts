export const getWeekNumber = (date: Date = new Date()) => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime();

  const weekNo = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);

  return weekNo;
};

export const CurrentWeek = getWeekNumber();
export const YEAR_WEEKSOFF =
  CurrentWeek > 34 ? 34 : /* CurrentWeek < 4 ? -17 : */ 5;

export function getTimez(startTime: string, durationMinutes = 90) {
  const padTime = (time: number) => time.toString().padStart(2, '0');

  const dateTime = new Date(0);

  const [hours, minutes] = startTime.split(':').map(Number);
  dateTime.setHours(hours, minutes);
  dateTime.setMinutes(dateTime.getMinutes() + durationMinutes);

  const endTime = `${padTime(dateTime.getHours())}:${padTime(
    dateTime.getMinutes(),
  )}`;

  // for safe
  dateTime.setHours(hours, minutes);
  startTime = `${padTime(dateTime.getHours())}:${padTime(
    dateTime.getMinutes(),
  )}`;

  return `${startTime}-${endTime}`;
}

export function short2Long2(e: number, q: 0 | 1 | 2 = 0) {
  switch (e) {
    case 0:
      return q === 0
        ? '📕'
        : q === 1
        ? 'Понедельник'
        : q === 2
        ? 'Понедельник'
        : null;
    case 1:
      return q === 0 ? '📗' : q === 1 ? 'Вторник' : q === 2 ? 'Вторник' : null;
    case 2:
      return q === 0 ? '📘' : q === 1 ? 'Среда' : q === 2 ? 'Среду' : null;
    case 3:
      return q === 0 ? '📙' : q === 1 ? 'Четверг' : q === 2 ? 'Четверг' : null;
    case 4:
      return q === 0 ? '📓' : q === 1 ? 'Пятница' : q === 2 ? 'Пятницу' : null;
    case 5:
      return q === 0 ? '📔' : q === 1 ? 'Суббота' : q === 2 ? 'Субботу' : null;
  }
}

export function getNumberEmoji(i: number) {
  switch (i % 10 || 1) {
    case 0:
      return '0⃣';
    case 1:
      return '1⃣';
    case 2:
      return '2⃣';
    case 3:
      return '3⃣';
    case 4:
      return '4⃣';
    case 5:
      return '5⃣';
    case 6:
      return '6⃣';
    case 7:
      return '7⃣';
    case 8:
      return '8⃣';
    case 9:
      return '9⃣';
  }
}
