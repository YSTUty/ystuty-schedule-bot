import { Global, Module } from '@nestjs/common';
import { TelegrafModule } from '@xtcry/nestjs-telegraf';
import * as RedisSession from 'telegraf-session-redis';

import * as xEnv from '@my-environment';

import { MainMiddleware } from './middleware/main.middleware';
import { MetricsMiddleware } from './middleware/metrics.middleware';
import { TelegramService } from './telegram.service';
import { TelegramKeyboardFactory } from './telegram-keyboard.factory';

import { MainUpdate } from './update/main.update';
import { ScheduleUpdate } from './update/schedule.update';
import { AuthScene } from './scene/auth.scene';
import { SelectGroupScene } from './scene/select-group.scene';

const middlewares = [MainMiddleware, MetricsMiddleware];
const providers = [
  ...middlewares,
  // updates
  MainUpdate,
  ScheduleUpdate,
  AuthScene,
  SelectGroupScene,
];

@Global()
@Module({})
export class TelegramModule {
  static register() {
    if (!xEnv.SOCIAL_TELEGRAM_BOT_TOKEN) {
      return { module: TelegramModule };
    }

    return {
      module: TelegramModule,
      imports: [
        TelegrafModule.forRootAsync({
          useFactory: async (
            mainMiddleware: MainMiddleware,
            metricsMiddleware: MetricsMiddleware,
          ) => ({
            token: xEnv.SOCIAL_TELEGRAM_BOT_TOKEN,
            launchOptions: false,

            middlewares: [
              mainMiddleware.middlewareForkAll,
              mainMiddleware,
              metricsMiddleware,
              // @ts-ignore
              new RedisSession({
                store: {
                  host: xEnv.REDIS_HOST,
                  port: xEnv.REDIS_PORT,
                  db: xEnv.REDIS_DATABASE,
                  password: xEnv.REDIS_PASSWORD,
                  prefix: xEnv.REDIS_PREFIX,
                },
                ttl: 7 * 24 * 3600,
                getSessionKey: (ctx) =>
                  `tg:session:${
                    (ctx.from && ctx.chat && `${ctx.from.id}:${ctx.chat.id}`) ||
                    (ctx.from && `${ctx.from.id}:${ctx.from.id}`)
                  }`,
              }) as RedisSession.default,
              // @ts-ignore
              new RedisSession({
                store: {
                  host: xEnv.REDIS_HOST,
                  port: xEnv.REDIS_PORT,
                  db: xEnv.REDIS_DATABASE,
                  password: xEnv.REDIS_PASSWORD,
                  prefix: xEnv.REDIS_PREFIX,
                },
                ttl: 7 * 24 * 3600,
                property: 'sessionConversation',
                getSessionKey: (ctx) =>
                  ctx.chat && `tg:session:conversation:${ctx.chat.id}`,
              }) as RedisSession.default,
              mainMiddleware.middlewareCleaner(),
              mainMiddleware.i18nMiddleware,
              // i18n,
              mainMiddleware.middlewareCleaner(true),
            ],
          }),
          inject: [...middlewares],
        }),
      ],
      providers: [TelegramService, TelegramKeyboardFactory, ...providers],
      exports: [TelegramService, TelegramKeyboardFactory, ...middlewares],
    };
  }
}
