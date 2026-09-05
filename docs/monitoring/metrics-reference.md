# Метрики бота: справка для Grafana

**Актуально на 4 сентября 2026 года.**

Этот документ — контракт текущих метрик `ystuty-schedule-bot` для доработки
Grafana dashboard. Источник истины: `src/models/metrics/metrics.service.ts`,
transport middleware и `src/environment/index.ts`.

Готовый импортируемый dashboard находится в
`grafana/ystuty-schedule-bot.dashboard.json`. Он уже использует переменную
datasource `${DS_PROMETHEUS}` вместо жёстко заданного UID.

## Быстрый контекст

- Метрики доступны по HTTP: `GET /api/metrics`, если
  `PROMETHEUS_ENABLED=true`.
- Каждая series приложения получает label `app` со значением `INSTANCE_NAME`;
  по умолчанию это `ystuty-schedule-bot`.
- При Pushgateway используется `job="schedule_bot_metrics"` и grouping
  `app=<INSTANCE_NAME>`. При прямом scrape label `job` задаётся самим
  Prometheus-конфигом, поэтому dashboard не должен рассчитывать только на
  конкретное значение `job`.
- Domain gauges пользователей, профилей, бесед и feedback пересчитываются из
  PostgreSQL при bootstrap и затем раз в минуту. Это актуальные состояния, а
  не накопительные события.
- Pushgateway вызывается best-effort и не задерживает старт приложения.
- Не все series появляются сразу: counter/histogram получает series только
  после первого события с конкретным набором labels.

## Переменные dashboard

Рекомендуемые переменные:

| Имя | Тип | PromQL / значение | Назначение |
| --- | --- | --- | --- |
| `DS_PROMETHEUS` | datasource | `prometheus` | Источник данных без UID в JSON. |
| `app` | query, multi | `label_values(ystuty_user_count, app)` | Экземпляр/окружение приложения. |
| `target_type` | custom, multi | `group,teacher` | Тип цели расписания. |
| `target` | query, multi | `label_values(ystuty_schedule_target_request_total{app=~"$app", target_type=~"$target_type"}, target)` | Конкретная группа или ID преподавателя; работает только при detailed-флаге. |
| `social` | custom, multi | `telegram,vkontakte` | Удобен для аудитории, бесед и подписок. |
| `campaign_id` | query, multi | `label_values(ystuty_broadcast_feedback_stored_count{app=~"$app"}, campaign_id)` | Кампания для подробной статистики feedback. |

Для regex-переменных в выражениях используй `=~"$variable"`, а для
одиночного фиксированного значения — `="value"`.

## Custom domain metrics

### Пользователи и доступность рассылок

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_user_count` | Gauge | `app` | Число **активных** сущностей `User`; забаненные не входят. |
| `ystuty_user_status_count` | Gauge | `status` | Пользователи по статусу: `active` или `banned`. |
| `ystuty_user_social_count` | Gauge | `social` | Достижимые ЛС-профили: `has_dm="true"` и `is_blocked="false"`. Не равно общему числу профилей. |
| `ystuty_user_social_status_count` | Gauge | `social`, `is_blocked`, `has_dm`, `is_authorized` | Полный breakdown профилей. `is_authorized` означает наличие связанного `userId` ЯГТУ.ID. |
| `ystuty_personal_notifications_disabled_count` | Gauge | `social` | Профили, отключившие личные автоматические уведомления через `broadcastDisabledAt`. Не включает беседы. |

Значения `social`: `telegram`, `vkontakte`. Значения boolean labels — строки
`"true"` и `"false"`.

Полезные запросы:

```promql
# Достижимая аудитория для каждой соцсети
ystuty_user_social_count{app=~"$app"}

# Сколько Telegram-профилей заблокировало бота
sum(ystuty_user_social_status_count{
  app=~"$app",
  social="telegram",
  is_blocked="true"
})

# Доля авторизованных среди достижимых Telegram-профилей
sum(ystuty_user_social_status_count{
  app=~"$app",
  social="telegram",
  has_dm="true",
  is_blocked="false",
  is_authorized="true"
})
/
sum(ystuty_user_social_status_count{
  app=~"$app",
  social="telegram",
  has_dm="true",
  is_blocked="false"
})
```

### Беседы

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_conversation_count` | Gauge | `social` | Все сохранённые беседы, включая те, из которых бот вышел/удалён. |
| `ystuty_conversation_status_count` | Gauge | `social`, `is_leaved`, `chat_status` | Статус присутствия бота и сохранённый Telegram/VK chat status. |

Допустимые нормализованные `chat_status`: `administrator`, `creator`,
`kicked`, `left`, `member`, `owner`, `restricted`, `unknown`, `other`.
`unknown` — отсутствующее значение, `other` — неожиданное значение из БД.

```promql
# Беседы, где бота больше нет
sum by (social, chat_status) (
  ystuty_conversation_status_count{app=~"$app", is_leaved="true"}
)
```

### Feedback административных рассылок

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_broadcast_feedback_stored_count` | Gauge | `campaign_id`, `social`, `action` | Число сохранённых feedback-кликов в БД. Пересчитывается из истории, поэтому отражает клики, сделанные ещё до включения метрики. |

`action`: `initial` — первый подтверждённый клик по delivery; `repeat` —
последующий клик. У `initial` есть ограничение один клик на delivery, а
`repeat` может быть больше одного.

Это **gauge**, не counter: для количества кликов используй его текущее
значение, а не `increase()`. Серии имеют label кампании, поэтому число series
растёт с количеством кампаний; для обзорной панели группируй по `social` и
`action`, а кампанию выбирай отдельной переменной.

```promql
# Суммарные клики по соцсети и типу клика
sum by (social, action) (
  ystuty_broadcast_feedback_stored_count{app=~"$app"}
)

# Feedback конкретной кампании
sum by (social, action) (
  ystuty_broadcast_feedback_stored_count{
    app=~"$app",
    campaign_id=~"$campaign_id"
  }
)
```

### Справочник и наполненность расписания

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_schedule_reference_count` | Gauge | `type` | Текущее количество элементов загруженного справочника; `type="institutes"` или `type="groups"`. |
| `ystuty_schedule_group_lesson_count` | Gauge, optional | `group`, `institute` | Число сырых lesson records для каждой доступной группы. |
| `ystuty_schedule_group_lesson_scan_timestamp_seconds` | Gauge, optional | — | Unix timestamp последнего полного успешного обхода групп. |

`ystuty_schedule_reference_count` обновляется при обновлении списка групп из
Schedule API. Это число доступных в справочнике групп, а не число групп с
непустым расписанием.

Две optional-метрики появляются только при:

```env
PROMETHEUS_SCHEDULE_AVAILABILITY_METRICS=true
```

Тогда раз в 30 минут сервис запрашивает расписание всех актуальных групп,
максимум четыре запроса параллельно и с timeout 15 секунд на запрос. Snapshot
публикуется только если завершились **все** запросы; при частичной ошибке
сохраняется предыдущее корректное значение. `lesson_count` считает сырые
записи: разные занятия подгрупп считаются отдельно.

```promql
# Текущее число доступных групп и институтов
ystuty_schedule_reference_count{app=~"$app"}

# Сколько групп уже имеет хотя бы одну запись расписания
count(ystuty_schedule_group_lesson_count{app=~"$app"} > 0)

# Группы без опубликованных занятий в последнем полном snapshot
count(ystuty_schedule_group_lesson_count{app=~"$app"} == 0)

# Давность последнего полного сканирования, секунды
time() - ystuty_schedule_group_lesson_scan_timestamp_seconds{app=~"$app"}
```

### Использование расписания

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_schedule_request_total` | Counter | `target_type` | Вызовы `ScheduleService` по цели: `group` или `teacher`. |
| `ystuty_schedule_target_request_total` | Counter, optional | `target_type`, `target` | То же, с конкретной группой или числовым ID преподавателя. |

Detailed series появляются только при:

```env
PROMETHEUS_DETAILED_SCHEDULE_TARGET_METRICS=true
```

Важно: это счётчик **вызовов ScheduleService**, а не гарантированно уникальных
действий пользователей. Он увеличивается до чтения кэша; включённый
`PROMETHEUS_SCHEDULE_AVAILABILITY_METRICS` также добавляет групповые вызовы
своим фоновым обходом. Для продуктовой статистики запросов групп не включай
availability scan на том же экземпляре либо учитывай его вклад.

```promql
# Запросы расписания за выбранный период
sum by (target_type) (
  increase(ystuty_schedule_request_total{app=~"$app"}[$__range])
)

# Скорость запросов в секунду
sum by (target_type) (
  rate(ystuty_schedule_request_total{app=~"$app"}[$__rate_interval])
)

# Топ-10 групп за выбранный диапазон, нужен detailed-флаг
topk(10,
  sum by (target) (
    increase(ystuty_schedule_target_request_total{
      app=~"$app",
      target_type="group"
    }[$__range])
  )
)
```

### Создание рассылок расписания

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_schedule_notif_created_total` | Counter | `social`, `scope`, `target_type` | Успешное создание нового notification schedule. |
| `ystuty_schedule_notif_target_created_total` | Counter, optional | `social`, `scope`, `target_type`, `target` | То же с конкретной группой/преподавателем. |

`scope`: `personal` или `conversation`. Counter увеличивается только при
создании новой записи; редактирование, повторное открытие настроек и включение
существующей рассылки его не увеличивают. В текущем UI создаются подписки на
группу, поэтому фактически ожидается `target_type="group"`; контракт допускает
также `teacher`.

```promql
# Новые подписки за период
sum by (social, scope, target_type) (
  increase(ystuty_schedule_notif_created_total{app=~"$app"}[$__range])
)

# Топ групп по новым подпискам, нужен detailed-флаг
topk(10,
  sum by (target) (
    increase(ystuty_schedule_notif_target_created_total{
      app=~"$app",
      target_type="group"
    }[$__range])
  )
)
```

## Transport metrics

### Telegram

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_telegram_request_total` | Counter | `updateType`, `status` | Завершённые входящие Telegram updates. |
| `ystuty_telegram_request_duration_bucket` / `_sum` / `_count` | Histogram | `updateType`, `status`, `le` | Длительность обработки update в секундах. |

### VK

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `ystuty_vk_request_total` | Counter | `updateType`, `status` | Завершённые входящие VK updates. |
| `ystuty_vk_request_duration_bucket` / `_sum` / `_count` | Histogram | `updateType`, `status`, `le` | Длительность обработки update в секундах. |

`status`: `success` или `error`. `updateType` зависит от API транспорта:
например, Telegram `message`, `callback_query`, `my_chat_member`; VK
`message`, `message_event` и другие реальные типы Long Poll updates.

Границы histogram: `0`, `0.05`, `0.10`, …, `0.45`, `+Inf` секунд. Это
короткий диапазон: если заметная часть событий попадёт в `+Inf`, p95 может
быть менее информативным — это повод отдельно расширить buckets.

```promql
# Все входящие updates за 30 минут
(sum(increase(ystuty_telegram_request_total{app=~"$app"}[30m])) or vector(0))
+
(sum(increase(ystuty_vk_request_total{app=~"$app"}[30m])) or vector(0))

# Ошибки входящих Telegram updates за период
sum by (updateType) (
  increase(ystuty_telegram_request_total{
    app=~"$app",
    status="error"
  }[$__range])
)

# P95 длительности успешных Telegram handlers, секунды
histogram_quantile(0.95,
  sum by (le, updateType) (
    rate(ystuty_telegram_request_duration_bucket{
      app=~"$app",
      status="success"
    }[$__rate_interval])
  )
)
```

## HTTP и runtime metrics

### HTTP

| Метрика | Тип | Labels | Семантика |
| --- | --- | --- | --- |
| `http_requests_bucket` / `_sum` / `_count` | Histogram | `method`, `status`, `path` | Длительность HTTP-запросов к маршрутам `/api`, кроме `/api/metrics` и favicon. |

`status` агрегирован: `2XX`, `3XX`, `4XX`, `5XX`. Значения URL-параметров
нормализуются как `#val`, чтобы ограничить cardinality. Не ожидай эту метрику
для Telegram/VK updates — у них отдельные transport metrics выше.

После исправления от 4 сентября 2026 года `http_exceptions` **больше не
создаётся**: legacy filter внешней библиотеки был отключён, поскольку ломался
на Telegraf context. Не добавляй новые панели на `http_exceptions`; старые
series могут оставаться в Prometheus до истечения retention.

### Default Node.js / process metrics

`withDefaultsMetrics=true` включает стандартные series `prom-client`, в том
числе:

| Группа | Основные series |
| --- | --- |
| Время жизни и CPU | `process_start_time_seconds`, `process_cpu_seconds_total`, `process_cpu_user_seconds_total`, `process_cpu_system_seconds_total` |
| Память процесса | `process_resident_memory_bytes`, `process_virtual_memory_bytes`, `process_heap_bytes` |
| File descriptors | `process_open_fds`, `process_max_fds` |
| Event loop | `nodejs_eventloop_lag_seconds`, `_min_seconds`, `_max_seconds`, `_mean_seconds`, `_stddev_seconds`, `_p50_seconds`, `_p90_seconds`, `_p99_seconds` |
| Handles/resources | `nodejs_active_handles`, `nodejs_active_handles_total`, `nodejs_active_resources`, `nodejs_active_resources_total`, `nodejs_active_requests`, `nodejs_active_requests_total` |
| V8 heap | `nodejs_heap_size_total_bytes`, `nodejs_heap_size_used_bytes`, `nodejs_external_memory_bytes`, `nodejs_heap_space_size_total_bytes`, `_used_bytes`, `_available_bytes` |
| GC | `nodejs_gc_duration_seconds_bucket`, `_sum`, `_count` |
| Версия Node.js | `nodejs_version_info` |

```promql
# Uptime, секунды
time() - process_start_time_seconds{app=~"$app"}

# CPU одного процесса в процентах одного ядра
100 * rate(process_cpu_seconds_total{app=~"$app"}[$__rate_interval])

# Event-loop p99, миллисекунды
1000 * nodejs_eventloop_lag_p99_seconds{app=~"$app"}

# Использование V8 heap, доля
nodejs_heap_size_used_bytes{app=~"$app"}
/
nodejs_heap_size_total_bytes{app=~"$app"}

# GC p95, секунды
histogram_quantile(0.95,
  sum by (le, kind) (
    rate(nodejs_gc_duration_seconds_bucket{app=~"$app"}[$__rate_interval])
  )
)
```

## Чего в метриках сейчас нет

Не строить панели как будто эти series уже существуют:

- статусы и скорость delivery административных broadcast-кампаний;
- число `sent` / `failed` / `retrying` по доставкам;
- Telegram rate-limit паузы и их длительность;
- текущая длина очереди Bull;
- количество фактически отправленных ежедневных уведомлений расписания;
- бизнес-ошибки Schedule API, Redis, PostgreSQL и Telegram/VK API;
- HTTP exception counter `http_exceptions` (отключён).

Для таких панелей сначала нужно отдельно расширить instrumentation, иначе
Grafana не сможет достоверно восстановить данные из логов или БД.

## Рекомендации по следующему изменению dashboard

1. Не менять имена существующих метрик и labels в JSON без изменения кода.
2. Для counters использовать `increase()`/`rate()`, для gauges — текущее
   значение. Не применять `increase()` к
   `ystuty_broadcast_feedback_stored_count`.
3. Разделить dashboard на Overview, Inbound/latency, Audience, Schedule usage,
   Schedule data completeness и Node.js runtime.
4. Сделать optional-панели для detailed target и lesson availability
   читаемыми, когда series ещё не появились: `or vector(0)` для Stat/Gauge,
   текст в description о feature flag для таблиц/topk.
5. Не строить график только по `job="schedule_bot_metrics"`: при прямом
   scrape job может называться иначе. Основной фильтр — `app`.
6. Для подробных group/teacher/campaign panels использовать variables и
   topk/table, а не постоянно выводить все series.

## Короткий handoff для нового агента

> Обнови `docs/monitoring/grafana/ystuty-schedule-bot.dashboard.json` на
> основе `docs/monitoring/metrics-reference.md`. Сохрани datasource variable
> `${DS_PROMETHEUS}`, фильтр `app`, не используй legacy `http_exceptions`.
> Counter panels должны использовать `increase`/`rate`, gauges — текущие
> значения. Учти optional feature flags detailed target и schedule availability,
> а также то, что broadcast delivery/queue metrics пока отсутствуют.
