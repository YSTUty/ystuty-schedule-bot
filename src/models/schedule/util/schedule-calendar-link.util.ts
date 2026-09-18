import * as xEnv from '@my-environment';

/** Приводит настроенный адрес сайта к URL без завершающего слеша. */
export const getWebsiteUrl = (address: string) => {
  const value = address.trim();
  if (!value) return null;

  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return url.replace(/\/+$/, '');
};

/**
 * Hash legacy-клиента может содержать кириллицу в читаемом виде.
 * Кодируем только символы, конфликтующие с URL или разделителем целей `,`.
 */
const encodeCalendarTarget = (target: string) =>
  target.replace(/[\s,%#?&+=;]/g, (character) => encodeURIComponent(character));

type ScheduleCalendarTarget = string | number | null | undefined;

const getSerializedCalendarTargets = (
  targets: ReadonlyArray<ScheduleCalendarTarget>,
) =>
  targets.flatMap((target) => {
    if (typeof target === 'number') {
      return Number.isSafeInteger(target) && target > 0 ? [String(target)] : [];
    }

    const value = target?.trim();
    return value ? [value] : [];
  });

const getScheduleCalendarUrl = (
  targets: ReadonlyArray<ScheduleCalendarTarget>,
  calendarAddress: string,
  encodeTarget: (target: string) => string,
) => {
  const calendarUrl = getWebsiteUrl(calendarAddress);
  if (!calendarUrl) return null;

  const serializedTargets = getSerializedCalendarTargets(targets);
  if (!serializedTargets.length) return null;

  return `${calendarUrl}/#${serializedTargets.map(encodeTarget).join(',')}`;
};

/**
 * Собирает readable legacy hash для показа ссылки пользователю.
 *
 * Клиент различает названия групп и числовые ID преподавателей самостоятельно;
 * запятая остаётся разделителем целей, поэтому каждое значение кодируется отдельно.
 */
export function getScheduleCalendarWebUrl(
  targets: ReadonlyArray<ScheduleCalendarTarget>,
  calendarAddress = xEnv.YSTUTY_ICALENDAR_ADDRESS,
) {
  return getScheduleCalendarUrl(targets, calendarAddress, encodeCalendarTarget);
}

/** Собирает fully encoded legacy hash для URL-кнопки мессенджера. */
export function getScheduleCalendarButtonUrl(
  targets: ReadonlyArray<ScheduleCalendarTarget>,
  calendarAddress = xEnv.YSTUTY_ICALENDAR_ADDRESS,
) {
  return getScheduleCalendarUrl(targets, calendarAddress, encodeURIComponent);
}
