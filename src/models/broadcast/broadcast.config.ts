import * as xEnv from '@my-environment';

import { DEFAULT_BROADCAST_HISTORY_LIMIT } from './broadcast.constants';

export function getBroadcastHistoryLimit(): number | null {
  const raw = xEnv.BROADCAST_HISTORY_LIMIT;
  if (!raw) return DEFAULT_BROADCAST_HISTORY_LIMIT;
  if (raw === 'false' || raw === 'off' || raw === '0') return null;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}
