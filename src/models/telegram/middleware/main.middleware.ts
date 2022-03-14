import { Injectable } from '@nestjs/common';
import { MiddlewareObj } from 'telegraf/typings/middleware';
import { Composer } from 'telegraf';
import { SOCIAL_TELEGRAM_BOT_NAME } from '@my-environment';
import { IContext } from '@my-interfaces/telegram';

@Injectable()
export class MainMiddleware implements MiddlewareObj<IContext> {
    public middleware() {
        const handler = async (
            ctx: IContext,
            next: (...args: any[]) => Promise<any>,
        ) => {
            if (ctx.from.is_bot) return;

            ctx.tryAnswerCbQuery = (...args) =>
                ctx.updateType === 'callback_query' &&
                ctx.answerCbQuery?.(...args);

            this.checkInGroupAppeal(ctx);

            await next?.();
        };
        return Composer.fork(handler);
    }

    public get middlewareCleaner() {
        return async (
            ctx: IContext,
            next: (...args: any[]) => Promise<any>,
        ) => {
            await next?.();
            this.cleanSession(ctx);
        };
    }

    private checkInGroupAppeal(ctx: IContext) {
        if (!('message' in ctx.update)) return;
        const {
            update: { message },
        } = ctx;
        ctx.state.appeal = false;

        if (
            'reply_to_message' in message &&
            message.reply_to_message.from?.id === ctx.botInfo.id
        ) {
            ctx.state.appeal = true;
        }

        if (!('text' in message)) return;

        const triggerRegexp = new RegExp(
            // `^@${SOCIAL_TELEGRAM_BOT_NAME},? `,
            `^.*(@${SOCIAL_TELEGRAM_BOT_NAME})$`,
            'i',
        );

        if (triggerRegexp.test(message.text)) {
            const triggerMsg = message.text.match(triggerRegexp);
            // message.text = message.text.slice(triggerMsg[0].length);
            message.text = message.text.slice(0, -triggerMsg[1].length);
            ctx.state.appeal = true;
        }
    }

    private cleanSession(ctx: IContext) {
        const { session } = ctx;
        if (!session) return;

        // Scene
        if (
            session['__scenes'] &&
            Object.keys(session['__scenes']).length === 0
        ) {
            delete session['__scenes'];
        }

        // i18n
        if (session['__language_code'] === 'ru') {
            delete session['__language_code'];
        }
    }
}
