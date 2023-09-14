import {
  Catch,
  ExceptionFilter,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { VkArgumentsHost, VkExecutionContext } from 'nestjs-vk';
import { APIError, MessageEventContext } from 'vk-io';
import * as Redlock from 'redlock';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/vk';
import { SOCIAL_VK_ADMIN_IDS } from '@my-environment';

@Catch()
export class VkExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(VkExceptionFilter.name);

  async catch(exception: Error, host: VkExecutionContext): Promise<void> {
    if (host.getType() !== 'vk-io') {
      return;
    }

    const vkHost = VkArgumentsHost.create(host);
    const ctx = vkHost.getContext<
      IContext<MessageEventContext> | IMessageContext
    >();

    if (
      exception.message !== LocalePhrase.Common_NoAccess &&
      // Не логировать `ForbiddenException`, т.к. ошибка доступа
      // проверяется по сообщению `LocalePhrase.Common_NoAccess`
      !(exception instanceof ForbiddenException) &&
      !(exception instanceof Redlock.LockError)
    ) {
      this.logger.error(
        `OnUpdateType(${ctx?.type}): ${exception?.message || exception}`,
        exception.stack,
      );
    }

    if (
      !(exception instanceof Error) ||
      !(ctx.answer || ctx.reply) ||
      exception instanceof ForbiddenException ||
      // * One of the parameters specified was missing or invalid
      (exception instanceof APIError && exception.code == 100)
    ) {
      return;
    }

    const isAdmin = SOCIAL_VK_ADMIN_IDS.includes(ctx.senderId);
    let content = '';
    switch (true) {
      case exception.message === LocalePhrase.Common_NoAccess:
        content = ctx.i18n.t(LocalePhrase.Common_NoAccess);
        break;
      case exception instanceof Redlock.LockError:
        content = ctx.i18n.t(LocalePhrase.Common_Cooldown);
        break;

      case isAdmin:
        content = `💢 Error: ${exception.message}`;
        break;

      default:
        content = ctx.i18n.t(LocalePhrase.Common_Error);
        break;
    }

    try {
      if (ctx.eventPayload && ctx.answer) {
        await ctx.answer({
          type: 'show_snackbar',
          text: content,
        });
      } else {
        await ctx.reply(content);
      }
    } catch {}
  }
}
