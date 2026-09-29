# Bot transport E2E

These tests start the real Nest application and route Telegram, VK and
Schedule API traffic to local stateful fake servers. Incoming user actions are
delivered through real Telegram polling and VK Bots Long Poll instead of by
calling update handlers directly.

## Local preparation

1. Copy `.env.e2e.example` to the ignored `.env.e2e` and complete local Redis
   settings. Keep `E2E_TEST_MODE=true`, an `-e2e`/`_e2e` PostgreSQL database
   name and an E2E Redis prefix.
2. Create the separate database. Before the suite, the harness applies pending
   TypeORM migrations itself when `E2E_RUN_MIGRATIONS` is not `false`.
   It never uses `synchronize` and refuses to do this outside the protected
   E2E database name.
3. Run:

   ```bash
   yarn test:bot-e2e
   ```

   Для короткого маршрута сценария (действие пользователя → подтверждённый
   вызов Bot API) запустите:

   ```bash
   yarn test:bot-e2e:trace
   ```

   Обычная команда остаётся компактной для CI; trace-режим предназначен для
   локальной отладки сценариев.

Before the suite the harness truncates application tables in the dedicated
PostgreSQL database and removes only keys under the configured E2E Redis
prefix. It deliberately preserves state after the suite for local inspection.

`E2E_SKIP_VK_UNREAD_RECOVERY=true` disables only the startup recovery of
unread VK direct messages in these polling scenarios. Recovery has dedicated
service specs; keeping it out of ordinary dialog tests prevents its detached
background pass from outliving a fake API during teardown.
