import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { VkArgumentsHost } from 'nestjs-vk';
import { MessageEventContext } from 'vk-io';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/vk';
import { SOCIAL_VK_ADMIN_IDS } from '@my-environment';

@Catch()
export class VkExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(VkExceptionFilter.name);

    async catch(exception: Error, host: ArgumentsHost): Promise<void> {
        const vkHost = VkArgumentsHost.create(host);
        const ctx = vkHost.getContext<
            IContext<MessageEventContext> | IMessageContext
        >();

        if (exception.message !== LocalePhrase.Common_NoAccess) {
            this.logger.error(
                `OnUpdateType(${ctx?.type}): ${
                    exception?.message || exception
                }`,
                exception.stack,
            );
        }

        if (!(exception instanceof Error) || !(ctx.answer || ctx.reply)) {
            return;
        }

        const isAdmin = SOCIAL_VK_ADMIN_IDS.includes(ctx.senderId);
        const content =
            exception.message === LocalePhrase.Common_NoAccess
                ? ctx.i18n.t(LocalePhrase.Common_NoAccess)
                : isAdmin
                ? `💢 Error: ${exception.message}`
                : ctx.i18n.t(LocalePhrase.Common_Error);

        try {
            if (ctx.eventPayload && ctx.answer) {
                ctx.answer({
                    type: 'show_snackbar',
                    text: content,
                });
            } else {
                ctx.reply(content);
            }
        } catch {}
    }
}
