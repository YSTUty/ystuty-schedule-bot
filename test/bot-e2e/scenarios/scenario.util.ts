import { setTimeout as delay } from 'node:timers/promises';

/** Даёт фоновой transport-очереди завершить запись session перед следующим update. */
export const waitForBackgroundUpdate = async () => {
  await delay(100);
};
