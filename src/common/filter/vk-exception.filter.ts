import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { VkArgumentsHost } from 'nestjs-vk';
import { MessageEventContext } from 'vk-io';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/vk';

@Catch()
export class VkExceptionFilter implements ExceptionFilter {
    async catch(exception: Error, host: ArgumentsHost): Promise<void> {
        const vkHost = VkArgumentsHost.create(host);
        const ctx = vkHost.getContext<
            IContext<MessageEventContext> | IMessageContext
        >();

        const adminIds = [
            // TODO
        ];
        const isAdmin = adminIds.includes(ctx.senderId);

        try {
            // TODO: remake it
            if (exception.message === LocalePhrase.Common_NoAccess) {
                ctx.reply(ctx.i18n.t(LocalePhrase.Common_NoAccess));
            } else {
                console.error(exception);

                if (exception instanceof Error && ctx) {
                    if (ctx.eventPayload && ctx.answer) {
                        ctx.answer({
                            type: 'show_snackbar',
                            text: isAdmin
                                ? `💢 Error: ${exception.message}`
                                : '💢 Error',
                        });
                    } else if (isAdmin) {
                        ctx.reply(`💢 Error: ${exception.message}`);
                    } else {
                        ctx.reply(ctx.i18n.t(LocalePhrase.Common_Error));
                    }
                }
            }
        } catch (err) {}
    }
}
