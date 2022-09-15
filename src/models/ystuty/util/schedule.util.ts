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
