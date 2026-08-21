import { Global, Module } from '@nestjs/common';
import { TelegrafModule } from '@xtcry/nestjs-telegraf';

import * as RedisSession from 'telegraf-session-redis';

import * as xEnv from '@my-environment';

import { MainMiddleware } from './middleware/main.middleware';
import { MetricsMiddleware } from './middleware/metrics.middleware';
import { UserMiddleware } from './middleware/user.middleware';
import { TelegramBroadcasterModule } from './model/broadcaster/telegram-broadcaster.module';
import { TgScheduleNotifModule } from './model/schedule-notif/tg-schedule-notif.module';
import { AuthScene } from './scene/auth.scene';
import { SelectGroupScene } from './scene/select-group.scene';
import { TelegramKeyboardFactory } from './telegram-keyboard.factory';
import { TelegramService } from './telegram.service';
import { AdminUpdate } from './update/admin.update';
import { MainUpdate } from './update/main.update';
import { ScheduleUpdate } from './update/schedule.update';

const baseProviders = [TelegramService, TelegramKeyboardFactory];
const middlewares = [MainMiddleware, MetricsMiddleware, UserMiddleware];
const providers = [
  ...middlewares,
  // updates
  AdminUpdate,
  MainUpdate,
  ScheduleUpdate,
  AuthScene,
  SelectGroupScene,
];

@Global()
@Module({})
export class TelegramModule {
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
          ) => ({
            token: xEnv.SOCIAL_TELEGRAM_BOT_TOKEN,
            launchOptions: false,
            options: { telegram: { apiRoot: xEnv.SOCIAL_TELEGRAM_API_ROOT } },
            middlewares: [
              mainMiddleware,
              metricsMiddleware,
              // @ts-expect-error RedisSession is typed against an older Telegraf middleware API.
              new RedisSession({
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
              }) as RedisSession.default,
              // @ts-expect-error RedisSession is typed against an older Telegraf middleware API.
              new RedisSession({
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
              }) as RedisSession.default,
              mainMiddleware.middlewareCleaner(),
              mainMiddleware.i18nMiddleware,
              userMiddleware,
              mainMiddleware.middlewareCleaner(true),
            ],
          }),
        }),
      ],
      providers: [...baseProviders, ...providers],
      exports: [...baseProviders, ...middlewares],
    };
  }
}
