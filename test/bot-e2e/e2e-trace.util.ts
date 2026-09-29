const TRACE_ENABLED = process.env.BOT_E2E_TRACE === 'true';

/**
 * Короткий маршрут E2E-сценария для локального запуска.
 * Отключён по умолчанию, чтобы CI оставался компактным.
 */
export const e2eTrace = (transport: 'TG' | 'VK', message: string) => {
  if (!TRACE_ENABLED) return;

  process.stdout.write(`[bot-e2e][${transport}] ${message}\n`);
};
