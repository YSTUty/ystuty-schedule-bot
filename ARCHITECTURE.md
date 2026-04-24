# ARCHITECTURE

## Назначение документа

Этот файл описывает внутреннюю архитектуру `ystuty-schedule-bot` и нужен для трех задач:

- быстро понять, как устроен сервис
- проще переносить фичи и фиксы из sibling-проектов
- видеть границы между общим кодом ботов и кодом, специфичным для расписания

## Архитектурный стиль

Проект представляет собой один NestJS-сервис с несколькими интеграционными адаптерами.

По сути архитектура выглядит так:

- один процесс приложения
- общие доменные сервисы в `src/models/*`
- отдельные адаптеры под каждый мессенджер
- общие типы, guards, filters и util-функции
- внешние API как источники данных и auth-потоков

Это не микросервисный набор внутри репозитория. Это один бот-сервис, который агрегирует несколько источников и несколько транспортов.

## Слои

### 1. Transport layer

Слой приема событий и отправки ответов.

- `src/models/telegram/*`
- `src/models/vk/*`

Здесь находятся:

- bootstrap мессенджера
- middleware
- update handlers
- scenes
- keyboard factories
- сервисы отправки сообщений и работы с runtime API клиента

### 2. Application layer

Слой, который координирует работу бизнес-сценариев.

- `src/models/user/user.service.ts`
- `src/models/social/social.service.ts`
- `src/models/social-connect/social-connect.service.ts`
- `src/models/ystuty/ystuty.service.ts`

Этот слой связывает транспорт, БД, Redis и внешние API.

### 3. Shared support layer

Общий слой инфраструктурных и кросс-срезовых частей.

- `src/common/*`
- `src/interface/*`
- `src/environment/index.ts`
- `src/models/metrics/*`
- `src/models/redis/*`

### 4. Persistence / external integration layer

- TypeORM + PostgreSQL
- Redis + Redlock
- Schedule API
- social-connect
- OAuth
- Prometheus Pushgateway

## Модульная схема

Упрощенная карта зависимостей:

```text
AppModule
 ├─ TelegramModule
 ├─ VkModule
 ├─ UserModule
 ├─ SocialModule
 ├─ SocialConnectModule
 ├─ YSTUtyModule
 ├─ RedisModule
 └─ MetricsModule

Telegram/VK updates & scenes
 ├─ используют UserService
 ├─ используют YSTUtyService
 ├─ используют keyboard factories
 └─ работают через middleware, guards, filters

UserService
 ├─ работает с User / UserSocial
 ├─ вызывает SocialConnectService
 ├─ использует TelegramService / VkService
 ├─ использует RedisService
 └─ обновляет MetricsService

SocialConnectService
 ├─ вызывает внешний social-connect
 └─ завершает auth через UserService

YSTUtyService
 ├─ вызывает Schedule API
 ├─ кэширует списки групп/преподавателей
 └─ отдает данные update-слою
```

## Поток обработки Telegram

Типовой путь запроса в Telegram:

1. `TelegramModule` поднимает бота и собирает middleware-цепочку.
2. В Redis подключаются две сессии:
   `session` для пользовательского состояния и `sessionConversation` для состояния чата.
3. `MainMiddleware`, `MetricsMiddleware`, `UserMiddleware` подготавливают контекст.
4. Nest listener routing отправляет апдейт в нужный `update` или `scene`.
5. При необходимости срабатывает `RolesGuard`.
6. В случае ошибок работает `TelegrafExceptionFilter`.
7. Handler обращается к `UserService`, `YSTUtyService`, `SocialService` и т.д.
8. Ответ уходит через `ctx.reply*` или через `TelegramService`.

Особенности:

- Telegram использует scene-механику активнее, чем VK.
- Для части сценариев важны ограничения по типу чата и silent skip.
- Есть отдельная логика для private chat и group/supergroup кейсов.

## Поток обработки VK

Типовой путь запроса в VK:

1. `VkModule` поднимает polling через `nestjs-vk`.
2. `middlewaresBefore` и `middlewaresAfter` подготавливают контекст.
3. Событие попадает в `update` или `scene`.
4. Доступ контролируется через тот же глобальный `RolesGuard`.
5. Ошибки проходят через `VkExceptionFilter`.
6. Handler обращается к общим сервисам.
7. Ответ уходит через `ctx.send`, `ctx.reply` или `VkService`.

Особенности:

- часть событий не имеет привычных message-полей
- есть различия по сессиям и структуре context относительно Telegram
- логика групповых бесед и прав админа отличается от Telegram

## Поток авторизации и привязки аккаунта

Это один из центральных общих сценариев между проектами.

Схема:

1. Пользователь в мессенджере инициирует auth.
2. Бот вызывает `SocialConnectService.requestAuth(...)`.
3. `social-connect` создает/обновляет внешний auth-процесс.
4. `SocialConnectService.checkAuth()` периодически проверяет результаты.
5. При подтверждении сервис вызывает `UserService.auth(...)`.
6. `UserService` обновляет `UserSocial`, пользователя и связанные токены.
7. Далее бот уведомляет пользователя и при необходимости обновляет выбранную группу.
8. Через `emulateSession(...)` сервис может принудительно закрыть auth scene в нужном транспорте.

Это место часто совпадает между ботами почти целиком и обычно является хорошим кандидатом для переноса фиксов.

## Хранение данных

### PostgreSQL

Основные сущности:

- `User` - доменный пользователь
- `UserSocial` - профиль пользователя в мессенджере
- `Conversation` - чат/диалог/беседа
- `UserToConversation` - связь участника с беседой

### Redis

Используется для:

- сессий Telegram
- сессий VK
- session state разговоров
- служебных ключей приложения
- распределенных блокировок через `redlock`

### In-memory cache

`YSTUtyService` хранит в памяти процесса:

- список групп
- список преподавателей

Это ускоряет обработку запросов и парсинг названий, но требует периодической перезагрузки данных.

## Общие механизмы доступа и обработки ошибок

### Guards

`RolesGuard` - глобальный guard, который:

- читает метаданные ролей
- поддерживает `AnyRoles`
- поддерживает silent reject для Telegram
- ограничивает Telegram handlers по типам чатов
- работает и для VK, и для Telegram

### Filters

Фильтры исключений разделены по транспорту:

- `TelegrafExceptionFilter`
- `VkExceptionFilter`
- `HttpExceptionFilter`

Здесь важны:

- корректная обработка `NoAccess`
- пропуск `SKIP` / `SKIP_FULL`
- корректная обработка Telegram/VK API ошибок
- отсутствие падения процесса на частых runtime ошибках

## Observability

Сервис имеет два основных механизма наблюдаемости:

- обычные логи Nest / Logger
- Prometheus-метрики

Собираются, например:

- количество пользователей
- количество соцпрофилей
- количество диалогов
- количество запросов к Telegram / VK
- длительность обработки запросов
- количество обращений к расписанию

## Что чаще всего переносится из sibling-проектов

При сравнении с похожими ботами в первую очередь стоит смотреть на такие блоки:

- `src/common/decorator/*`
- `src/common/filter/*`
- `src/common/guard/*`
- `src/models/*/middleware/*`
- `src/models/*/*.service.ts`, где нет жесткой schedule-специфики
- `src/interface/telegram/*` и `src/interface/vk/*`
- env-конфигурацию и package versions

Это те зоны, где чаще всего появляются фиксы, а потом частично или с задержкой переносятся в другие проекты.

## Что может отличаться между проектами намеренно

Ниже различия, которые не надо автоматически выравнивать без проверки смысла:

- набор слушателей и `update`-классов
- тексты и локали
- keyboard factories и callback payload
- scenes и сценарии выбора данных
- состав интеграций
- набор поддерживаемых мессенджеров

Например, в sibling-проекте может уже существовать модуль для `max`, а в этом проекте его еще нет.

## Рискованные зоны при изменениях

### 1. Session keys и `emulateSession`

Если ошибиться в ключах Redis или в схеме закрытия сессии, сломаются auth flow, scene state и скрытая синхронизация между транспортом и доменным слоем.

### 2. Middleware order

Порядок middleware влияет на наличие пользователя, i18n, метрик и корректную очистку контекста.

### 3. Guards / filters

Эти части часто ломаются не сразу, а только на отдельных типах апдейтов, чатах или правах доступа.

### 4. Dependency versions

В проекте уже были случаи, когда обновление пакета меняло поведение инфраструктурного слоя. Это особенно важно для `@nestjs/typeorm`, `typeorm`, `pg`, `telegraf`, `nestjs-vk` и связанных библиотек.

### 5. Telegram / VK API edge cases

Ошибки вида `429`, `403 bot was kicked`, отсутствующие поля в event context и проблемы с rate limit должны обрабатываться аккуратно, иначе процесс может падать на бою.

## Практический чек-лист перед переносом изменений из sibling-проекта

1. Сравнить package versions и lockfile.
2. Сравнить `environment/index.ts`.
3. Сравнить `common/decorator`, `common/filter`, `common/guard`.
4. Сравнить `telegram.service.ts`, `vk.service.ts`, `user.service.ts`, `social-connect.service.ts`.
5. Проверить различия в `IContext`, session state и middleware-порядке.
6. Проверить, что переносимый код не зависит от модуля `max` или других отсутствующих транспортов.
7. Проверить, что логика нужна именно сервису расписания, а не другому доменному сценарию.

## Текущее известное ограничение по зависимостям

Сейчас проект закреплен на `@nestjs/typeorm@11.0.0`.

Причина:

- на `11.0.1` наблюдались кейсы, где некоторые импорты становились `undefined`
- из-за этого metadata не читалась корректно
- возможная причина связана с совместимостью версий `@nestjs/typeorm`, `typeorm` и `pg`

Возвращаться к обновлению надо отдельной задачей вместе с ревизией версий связанных библиотек.
