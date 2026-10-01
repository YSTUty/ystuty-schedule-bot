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
Before each `it` it performs the same isolated cleanup and resets only the
recorded state of fake APIs; the Nest application and real polling loops stay
alive. This keeps additional scenarios inexpensive without leaking sessions,
outgoing calls or persistent profiles between cases.

`E2E_SKIP_VK_UNREAD_RECOVERY=true` disables only the startup recovery of
unread VK direct messages in these polling scenarios. Recovery has dedicated
service specs; keeping it out of ordinary dialog tests prevents its detached
background pass from outliving a fake API during teardown.

## Current coverage boundary

| Flow | Telegram | VK |
| --- | --- | --- |
| `/start`, keyboard, institute → group selection | yes | yes |
| Persisted `UserSocial.groupName` after middleware | yes | yes |
| Day/week schedule and inline navigation | yes | yes |
| Callback acknowledgement and edit/send contract | `answerCallbackQuery`, including edit fallback | edit-or-send fallback for `message_event` |
| Delivery becomes unavailable and profile restoration after inbound message | not yet | not yet |
| Cached schedule after Schedule API error | yes | yes |
| Same-poll burst and transport/session isolation | two Telegram users | two VK users |
| VK `message_allow` / `message_deny` persistence without outgoing reply | not applicable | yes |

The suite intentionally does **not** replace focused service specs for VK
unread recovery, cache-lock edge cases, rate-limit retry policy, scheduler
deliveries, auth through `social-connect`, or every keyboard layout. Add a
transport E2E only when it validates the route from an incoming protocol update
through real middleware to an external API call.

## Future extraction boundary

The fake HTTP servers and PostgreSQL/Redis harness are specific to this bot.
They model only the methods required by its scenarios and must not become a
second implementation of Telegram or VK protocols.

After a second bot needs the same capability, consider moving only explicit
polling lifecycle, auto-launch opt-out during a testing bootstrap,
transport-client injection and possibly in-process raw-update dispatch into
our `nestjs-telega` / `nestjs-vk` libraries. Comments near those seams mark
the boundary without carrying project fixtures into the wrappers.
