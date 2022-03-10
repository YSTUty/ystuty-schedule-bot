import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { TelegrafArgumentsHost } from '@xtcry/nestjs-telegraf';
import { TelegramError } from 'telegraf';
import { escapeHTMLCodeChars } from '@my-common';
import { SOCIAL_TELEGRAM_ADMIN_IDS } from '@my-environment';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

@Catch()
export class TelegrafExceptionFilter implements ExceptionFilter {
    constructor() {}

    async catch(exception: Error, host: ArgumentsHost): Promise<void> {
        const telegrafHost = TelegrafArgumentsHost.create(host);
        const ctx = telegrafHost.getContext<IContext>();

        const isAdmin = SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id);

        try {
            if (exception.message === LocalePhrase.Common_NoAccess) {
                ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Common_NoAccess));
            } else {
                console.error(exception);

                if (exception instanceof Error && ctx) {
                    if (exception instanceof TelegramError) {
                        if (
                            exception.description.includes(
                                'bot was blocked by the user',
                            ) ||
                            exception.description.includes(
                                'user is deactivated',
                            ) ||
                            exception.description.includes('chat not found')
                        ) {
                            try {
                                // ctx.user.isBlockedBot = true;
                                ctx.session.isBlockedBot = true;
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    } else if (
                        ctx.updateType === 'callback_query' &&
                        ctx.answerCbQuery
                    ) {
                        if (isAdmin) {
                            ctx.answerCbQuery(
                                `💢 Error: ${escapeHTMLCodeChars(
                                    exception.message,
                                )}`,
                                { show_alert: true },
                            );
                        } else {
                            ctx.answerCbQuery('💢 Error');
                        }
                    } else if (isAdmin) {
                        ctx.replyWithHTML(
                            `💢 Error:\n<b>${escapeHTMLCodeChars(
                                exception.message,
                            )}</b>\n<code>${escapeHTMLCodeChars(
                                exception.stack
                                    .split('\n')
                                    .slice(0, 5)
                                    .join('\n'),
                            )}</code>`,
                        );
                    } else {
                        ctx.replyWithHTML(
                            ctx.i18n.t(LocalePhrase.Common_Error),
                        );
                    }
                }
            }
        } catch (err) {}
    }
}
