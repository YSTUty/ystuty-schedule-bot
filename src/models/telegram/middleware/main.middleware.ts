import { Injectable } from '@nestjs/common';
import { MiddlewareObj } from 'telegraf/typings/middleware';
import { Composer } from 'telegraf';
import {
    SOCIAL_TELEGRAM_ADMIN_IDS,
    SOCIAL_TELEGRAM_BOT_NAME,
} from '@my-environment';
import { escapeHTMLCodeChars } from '@my-common';
import { IContext } from '@my-interfaces/telegram';

@Injectable()
export class MainMiddleware implements MiddlewareObj<IContext> {
    middleware() {
        const handler = async (
            ctx: IContext,
            next: (...args: any[]) => Promise<any>,
        ) => {
            if (ctx.from.is_bot) return;

            ctx.tryAnswerCbQuery = (...args) =>
                ctx.updateType === 'callback_query' &&
                ctx.answerCbQuery?.(...args);

            this.checkInGroupAppeal(ctx);

            try {
                await next?.();
            } catch (err: unknown) {
                console.error(err);

                if (err instanceof Error) {
                    const isAdmin = SOCIAL_TELEGRAM_ADMIN_IDS.includes(
                        ctx.from.id,
                    );
                    if (
                        ctx.updateType === 'callback_query' &&
                        ctx.answerCbQuery
                    ) {
                        if (isAdmin) {
                            ctx.answerCbQuery(
                                `💢 Error: ${escapeHTMLCodeChars(err.message)}`,
                                { show_alert: true },
                            );
                        } else {
                            ctx.answerCbQuery('💢 Error');
                        }
                    } else if (isAdmin) {
                        ctx.replyWithHTML(
                            `💢 Error:\n<b>${escapeHTMLCodeChars(
                                err.message,
                            )}</b>\n<code>${escapeHTMLCodeChars(
                                err.stack.split('\n').slice(0, 5).join('\n'),
                            )}</code>`,
                        );
                    }
                }
            }
        };
        return Composer.fork(handler);
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
}
