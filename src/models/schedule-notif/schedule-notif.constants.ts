/** Максимум независимых целей для настроек одной области доставки. */
export const PERSONAL_SCHEDULE_NOTIF_LIMIT = 8;
export const CONVERSATION_SCHEDULE_NOTIF_LIMIT = 6;

export const SCHEDULE_NOTIF_QUEUE_NAME = 'schedule-notif';
export const SCHEDULE_NOTIF_TELEGRAM_QUEUE_NAME = `${SCHEDULE_NOTIF_QUEUE_NAME}:telegram`;
export const SCHEDULE_NOTIF_VK_QUEUE_NAME = `${SCHEDULE_NOTIF_QUEUE_NAME}:vkontakte`;

/** Одна попытка и три повтора для временных ошибок транспорта или Schedule API. */
export const SCHEDULE_NOTIF_MAX_RETRY_ATTEMPTS = 4;
export const SCHEDULE_NOTIF_RETRY_BASE_DELAY_MS = 30e3;
export const SCHEDULE_NOTIF_RETRY_MAX_DELAY_MS = 5 * 60e3;
/** Позднее расписание теряет актуальность и не должно прийти через часы после сбоя. */
export const SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS = 30 * 60e3;
