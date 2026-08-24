import * as xEnv from '@my-environment';

/** Возвращает лимит истории только при явном включении автоочистки. */
export function getBroadcastHistoryLimit(): number | null {
  const raw = xEnv.BROADCAST_HISTORY_LIMIT;
  if (!raw) return null;
  if (raw === 'false' || raw === 'off' || raw === '0') return null;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}
