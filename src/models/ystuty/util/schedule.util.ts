export const getWeekNumber = (date: Date = new Date()) => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime();

  const weekNo = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);

  return weekNo;
};

export const getWeekOffsetByYear = (currentDate: Date = new Date()) => {
  const currentYear = currentDate.getFullYear();
  const currentWeek = getWeekNumber(currentDate);

  const firstSeptemberDate = new Date(currentYear, 8, 1);
  // // TODO?: надо ли учитывать (подкрутить день/два), если выходит выходной день?
  // * Учитываем, если 1 сентября выпало на воскресенье
  // ? а если на Субботу?..
  if (firstSeptemberDate.getDay() === 0) {
    firstSeptemberDate.setDate(firstSeptemberDate.getDate() + 1);
  }
  const firstSeptemberWeek = getWeekNumber(firstSeptemberDate);

  // console.log('Weeker', {
  //   currentYear,
  //   currentWeek,
  //   firstSeptemberWeek,
  // });
  // Если текущая неделя больше первой недели сентября
  if (currentWeek > firstSeptemberWeek - 1) {
    return firstSeptemberWeek - 1;
  }

  const firstFebruaryDate = new Date(currentYear, 1, 1);
  // TODO?: надо ли учитывать (подкрутить день/два), если выходит выходной день?
  const firstFebruaryWeek = getWeekNumber(firstFebruaryDate);
  // Если текущая неделя меньше первой недели февраля (значит фиксим прошлогоднюю неделю)
  if (currentWeek < firstFebruaryWeek) {
    const prevYear = currentYear - 1;
    // TODO?: надо ли учитывать (подкрутить день/два), если выходит выходной день?
    const firstSeptemberPrevYearDate = new Date(prevYear, 8, 1);
    const lastPrevYearDate = new Date(prevYear, 11, 31);

    // console.log('Weeker...', {
    //   firstSeptemberPrevYearDate: firstSeptemberPrevYearDate.toISOString(),
    //   lastPrevYearDate: lastPrevYearDate.toISOString(),
    //   lastPrevYearWeek: getWeekNumber(lastPrevYearDate),
    //   firstSeptemberPrevYearWeek: getWeekNumber(firstSeptemberPrevYearDate),
    // });

    return -(
      getWeekNumber(lastPrevYearDate) -
      getWeekNumber(firstSeptemberPrevYearDate) +
      1
    );
  }

  // Первая неделя февраля
  return firstFebruaryWeek;
};

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
      return q === 0 ? '📕' : q === 1 || q === 2 ? 'Понедельник' : null;
    case 1:
      return q === 0 ? '📗' : q === 1 || q === 2 ? 'Вторник' : null;
    case 2:
      return q === 0 ? '📘' : q === 1 ? 'Среда' : q === 2 ? 'Среду' : null;
    case 3:
      return q === 0 ? '📙' : q === 1 || q === 2 ? 'Четверг' : null;
    case 4:
      return q === 0 ? '📓' : q === 1 ? 'Пятница' : q === 2 ? 'Пятницу' : null;
    case 5:
      return q === 0 ? '📔' : q === 1 ? 'Суббота' : q === 2 ? 'Субботу' : null;
    case 6:
      return q === 0 ? '📕' : q === 1 || q === 2 ? 'Воскресенье' : null;
  }
}

export function getNumberEmoji(i: number) {
  switch (i % 10) {
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
