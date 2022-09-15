import { HttpModule } from '@nestjs/axios';
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
                    useFactory: async (featuresMiddleware: MainMiddleware) => ({
                        token: xEnv.SOCIAL_TELEGRAM_BOT_TOKEN,
                        launchOptions: false,

                        middlewares: [
                            featuresMiddleware.middlewareForkAll,
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
                                getSessionKey: (ctx) =>
                                    (ctx.from &&
                                        ctx.chat &&
                                        `${ctx.from.id}:${ctx.chat.id}`) ||
                                    (ctx.from &&
                                        `${ctx.from.id}:${ctx.from.id}`),
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
                            featuresMiddleware.middlewareCleaner(),
                            i18n,
                            featuresMiddleware.middlewareCleaner(true),
                        ],
                    }),
                    inject: [...middlewares],
                }),
            ],
            providers: [
                TelegramService,
                TelegramKeyboardFactory,
                ...middlewares,
                SelectGroupScene,
                StartTelegramUpdate,
            ],
            exports: [TelegramService, TelegramKeyboardFactory, ...middlewares],
        };
    }
}
