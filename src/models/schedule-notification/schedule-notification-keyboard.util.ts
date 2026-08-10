export type ScheduleNotificationPage<T> = {
  currentPage: number;
  totalPages: number;
  rows: T[][];
  previousPage?: number;
  nextPage?: number;
};

/** Разбивает варианты выбора на страницы с фиксированным количеством колонок. */
export const buildScheduleNotificationPage = <T>(
  items: T[],
  page: number,
  pageSize: number,
  columns = 3,
): ScheduleNotificationPage<T> => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const pageItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return {
    currentPage,
    totalPages,
    rows: Array.from(
      { length: Math.ceil(pageItems.length / columns) },
      (_, rowIndex) =>
        pageItems.slice(rowIndex * columns, (rowIndex + 1) * columns),
    ),
    ...(currentPage > 1 && { previousPage: currentPage - 1 }),
    ...(currentPage < totalPages && { nextPage: currentPage + 1 }),
  };
};
