import { Global, Logger, Module } from '@nestjs/common';
import { TelegrafModule } from '@xtcry/nestjs-telegraf';

import * as RedisSession from 'telegraf-session-redis';

import * as xEnv from '@my-environment';

import { withRedisSessionLoadRetry } from '@my-common/util/redis-session-retry.util';

import { MainMiddleware } from './middleware/main.middleware';
import { MetricsMiddleware } from './middleware/metrics.middleware';
import { UnhandledPrivateMessageMiddleware } from './middleware/unhandled-private-message.middleware';
import { UserMiddleware } from './middleware/user.middleware';
import { TelegramBroadcasterModule } from './model/broadcaster/telegram-broadcaster.module';
import { TgScheduleNotifModule } from './model/schedule-notif/tg-schedule-notif.module';
import { AuthScene } from './scene/auth.scene';
import { TelegramFeedbackScene } from './scene/feedback.scene';
import { SelectGroupScene } from './scene/select-group.scene';
import { TelegramKeyboardFactory } from './telegram-keyboard.factory';
import { TelegramService } from './telegram.service';
import { AdminUpdate } from './update/admin.update';
import { TelegramFeedbackUpdate } from './update/feedback.update';
import { MainUpdate } from './update/main.update';
import { ScheduleUpdate } from './update/schedule.update';

const TelegramRedisSession =
  RedisSession as unknown as typeof RedisSession.default;

const baseProviders = [TelegramService, TelegramKeyboardFactory];
const middlewares = [MainMiddleware, MetricsMiddleware, UserMiddleware];
const providers = [
  ...middlewares,
  UnhandledPrivateMessageMiddleware,
  // updates
  AdminUpdate,
  TelegramFeedbackUpdate,
  MainUpdate,
  ScheduleUpdate,
  AuthScene,
  TelegramFeedbackScene,
  SelectGroupScene,
];

@Global()
@Module({})
export class TelegramModule {
  private static logger = new Logger(TelegramModule.name);

  static register() {
    return {
      module: TelegramModule,
      imports: [
        TelegramBroadcasterModule,
        TgScheduleNotifModule,
        TelegrafModule.forRootAsync({
          inject: [...middlewares],
          useFactory: async (
            mainMiddleware: MainMiddleware,
            metricsMiddleware: MetricsMiddleware,
            userMiddleware: UserMiddleware,
          ) => {
            const session = new TelegramRedisSession({
              store: {
                host: xEnv.REDIS_HOST,
                port: xEnv.REDIS_PORT,
                db: xEnv.REDIS_DATABASE,
                password: xEnv.REDIS_PASSWORD,
                prefix: xEnv.REDIS_PREFIX,
              },
              ttl: 3 * 7 * 24 * 3600,
              getSessionKey: (ctx) =>
                `tg:session:${
                  (ctx.from && ctx.chat && `${ctx.from.id}:${ctx.chat.id}`) ||
                  (ctx.from && `${ctx.from.id}:${ctx.from.id}`)
                }`,
            });
            const sessionConversation = new TelegramRedisSession({
              store: {
                host: xEnv.REDIS_HOST,
                port: xEnv.REDIS_PORT,
                db: xEnv.REDIS_DATABASE,
                password: xEnv.REDIS_PASSWORD,
                prefix: xEnv.REDIS_PREFIX,
              },
              ttl: 3 * 7 * 24 * 3600,
              property: 'sessionConversation',
              getSessionKey: (ctx) =>
                ctx.chat && `tg:session:conversation:${ctx.chat.id}`,
            });

            return {
              token: xEnv.SOCIAL_TELEGRAM_BOT_TOKEN,
              launchOptions: false,
              options: {
                telegram: { apiRoot: xEnv.SOCIAL_TELEGRAM_API_ROOT },
              },
              middlewares: [
                mainMiddleware,
                metricsMiddleware,
                withRedisSessionLoadRetry(session.middleware(), {
                  onRetry: (error) =>
                    this.logger.warn(
                      `[Redis session] Retrying session load after transient connection error: ${error.message}`,
                    ),
                }),
                withRedisSessionLoadRetry(sessionConversation.middleware(), {
                  onRetry: (error) =>
                    this.logger.warn(
                      `[Redis session] Retrying conversation session load after transient connection error: ${error.message}`,
                    ),
                }),
                mainMiddleware.middlewareCleaner(),
                mainMiddleware.i18nMiddleware,
                userMiddleware,
                mainMiddleware.middlewareCleaner(true),
              ],
            };
          },
        }),
      ],
      providers: [...baseProviders, ...providers],
      exports: [...baseProviders, ...middlewares],
    };
  }
}
