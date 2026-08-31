const unsubscribeTexts = new Set([
  '/unsubscribe',
  'отписаться',
  'больше не студент',
]);

/** Исключает сам flow отключения из автоматического восстановления рассылок. */
export const isBroadcastUnsubscribeText = (value?: string | null) =>
  !!value && unsubscribeTexts.has(value.trim().toLowerCase());

/** Callback подтверждения либо campaign-кнопка не должны восстанавливать подписку. */
export const isBroadcastUnsubscribeCallback = (value?: string | null) =>
  !!value &&
  (value.startsWith('broadcast:unsubscribe:') ||
    /^broadcast:action:\d+:unsubscribe$/.test(value));

export const isBroadcastUnsubscribeEvent = (
  payload?: Record<string, unknown>,
) =>
  payload?.broadcastUnsubscribe === 'confirm' ||
  payload?.broadcastUnsubscribe === 'cancel' ||
  payload?.broadcastRecipientAction === 'unsubscribe';
