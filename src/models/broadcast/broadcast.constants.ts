export const BROADCAST_QUEUE_NAME = 'broadcast';
export const BROADCAST_TELEGRAM_QUEUE_NAME = `${BROADCAST_QUEUE_NAME}:telegram`;
export const BROADCAST_VK_QUEUE_NAME = `${BROADCAST_QUEUE_NAME}:vkontakte`;

export const TELEGRAM_BROADCAST_SCENE = 'TELEGRAM_BROADCAST_SCENE';
export const VK_BROADCAST_SCENE = 'VK_BROADCAST_SCENE';

/** Версия формата настроек, которые можно применить в новом wizard рассылки. */
export const BROADCAST_CAMPAIGN_SETTINGS_VERSION = 1;

export const DEFAULT_BROADCAST_JOB_DELAY_MS = 300;
export const DEFAULT_BROADCAST_JOB_CONCURRENCY = 1;
export const DEFAULT_BROADCAST_PROGRESS_INTERVAL_MS = 2500;
export const DEFAULT_BROADCAST_PROGRESS_STEP = 10;
