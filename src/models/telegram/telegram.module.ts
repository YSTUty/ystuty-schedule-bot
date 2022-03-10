import { Global, Module } from '@nestjs/common';
import { TelegrafModule } from '@xtcry/nestjs-telegraf';
import * as RedisSession from 'telegraf-session-redis';
import * as xEnv from '@my-environment';

import { MainMiddleware } from './middleware/main.middleware';
import { i18n } from './util/i18n.util';
import { TelegramService } from './telegram.service';
import { TelegramKeyboardFactory } from './telegram-keyboard.factory';

import { StartTelegramUpdate } from './telegram.update';
import { SelectGroupScene } from './scene/select-group.scene';

const middlewares = [MainMiddleware];

@Global()
@Module({
    ...(xEnv.SOCIAL_TELEGRAM_BOT_TOKEN && {
        imports: [
            TelegrafModule.forRootAsync({
                useFactory: async (featuresMiddleware: MainMiddleware) => ({
                    token: xEnv.SOCIAL_TELEGRAM_BOT_TOKEN,
                    launchOptions: false,

                    middlewares: [
                        featuresMiddleware,
                        // @ts-ignore
                        new RedisSession({
                            store: {
                                host: xEnv.REDIS_HOST,
                                port: xEnv.REDIS_PORT,
                                db: xEnv.REDIS_DATABASE,
                                password: xEnv.REDIS_PASSWORD,
                                prefix: 'tg:session:',
                            },
                            ttl: 7 * 24 * 3600,
                        }) as RedisSession.default,
                        // @ts-ignore
                        new RedisSession({
                            store: {
                                host: xEnv.REDIS_HOST,
                                port: xEnv.REDIS_PORT,
                                db: xEnv.REDIS_DATABASE,
                                password: xEnv.REDIS_PASSWORD,
                                prefix: 'tg:session:',
                            },
                            ttl: 7 * 24 * 3600,
                            property: 'sessionConversation',
                            getSessionKey: (ctx) =>
                                ctx.chat && `conversation:${ctx.chat.id}`,
                        }) as RedisSession.default,
                        i18n,
                    ],
                }),
                inject: [...middlewares],
            }),
            StartTelegramUpdate,
        ],
        providers: [
            TelegramService,
            TelegramKeyboardFactory,
            ...middlewares,
            SelectGroupScene,
        ],
        exports: [TelegramService, TelegramKeyboardFactory, ...middlewares],
    }),
})
export class TelegramModule {}
