# Monitoring

## Grafana

`grafana/ystuty-schedule-bot.dashboard.json` — импортируемый Grafana
dashboard для Prometheus-метрик бота.

Файл сохраняет UID существующего dashboard, но Prometheus datasource выбирается
через переменную `${DS_PROMETHEUS}`. После импорта выбери источник в верхней
части dashboard — это позволяет использовать JSON в любой Grafana без замены
захардкоженного UID.

Подробная статистика целей расписания требует:

```env
PROMETHEUS_DETAILED_SCHEDULE_TARGET_METRICS=true
```

До первого запроса расписания после включения флага серии
`ystuty_schedule_target_request_total` не появятся, поэтому detailed-панели
групп и преподавателей будут пустыми.

## Состав dashboard

- **Overview** — непрерывная работа процесса, пользователи и активность за
  последние 30 минут.
- **Inbound updates and handler performance** — Telegram/VK updates, ошибки и
  p95 длительности обработки.
- **Audience and conversations** — пользователи, доступность ЛС, авторизация
  и беседы, из которых бот удалён или вышел.
- **Schedule usage** — запросы групп и преподавателей, top-10 и выбор
  конкретной цели через переменные `Schedule target type` и `Schedule target`.
- **Node.js runtime** — CPU, память, event-loop lag, handles/resources,
  file descriptors, GC и V8 heap spaces.

Панели detailed-статистики намеренно могут быть пустыми до первого обращения
к конкретной группе или преподавателю. В текущей метрике преподаватели
обозначаются числовым ID, а группы — названием.
