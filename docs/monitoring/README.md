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
`ystuty_schedule_target_request_total` не появятся, поэтому панель top-5
будет пустой.
