import {
  Catch,
  ExceptionFilter,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { VkArgumentsHost, VkException, VkExecutionContext } from 'nestjs-vk';

import { APIError, APIErrorCode, MessageEventContext } from 'vk-io';

import * as xEnv from '@my-environment';

import {
  isConcurrencyControlError,
  isCooldownError,
  UserException,
} from '@my-common/exception';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/vk';

export const isVkUserUnavailableError = (error: APIError) =>
  // error.code === APIErrorCode.PERMISSION ||
  // TODO: need valid this codes
  // error.code === APIErrorCode.ACCESS ||
  // error.code === APIErrorCode.ACTION_FAILED ||
  error.code === APIErrorCode.MESSAGES_USER_BLOCKED ||
  error.code === APIErrorCode.MESSAGES_DENY_SEND ||
  error.code === APIErrorCode.MESSAGES_PRIVACY ||
  // error.code === APIErrorCode.USER_BANNED ||
  // error.code === APIErrorCode.USER_DEACTIVATED ||
  // error.code === APIErrorCode.USER_DELETED ||
  // TODO: need valid this messages
  /bot was blocked by the user/i.test(error.message) ||
  /user is deactivated/i.test(error.message);

export const isVkConversationUnavailableError = (error: APIError) =>
  // error.code === APIErrorCode.PERMISSION ||
  // TODO: need valid this codes
  error.code === APIErrorCode.MESSAGES_CHAT_DISABLED ||
  error.code === APIErrorCode.MESSAGES_CHAT_NOT_EXIST ||
  error.code === APIErrorCode.MESSAGES_CHAT_USER_LEFT ||
  error.code === APIErrorCode.MESSAGES_CHAT_USER_NO_ACCESS ||
  // Permission to perform this action is denied: the user was kicked out of the conversation
  /kicked out of the conversation/i.test(error.message);

export const isVkRateLimitError = (error: APIError) =>
  error.code === APIErrorCode.RATE_LIMIT ||
  error.message.includes('Too Many Requests');

/** Возвращает имя метода VK API из безопасной части ответа об ошибке. */
export const getVkApiErrorMethod = (error: APIError) =>
  error.params.find((param) => param.key === 'method')?.value;

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
    const next = vkHost.getNext();
    const isCCE = isConcurrencyControlError(exception);

    if (
      exception instanceof VkException &&
      (exception.message === 'SKIP_FULL' || exception.message === 'SKIP')
    ) {
      await next?.();
      return;
    }

    if (
      exception.message !== LocalePhrase.Common_NoAccess &&
      // Не логировать `ForbiddenException`, т.к. ошибка доступа
      // проверяется по сообщению `LocalePhrase.Common_NoAccess`
      !(exception instanceof ForbiddenException) &&
      !isCCE
    ) {
      const apiMethod =
        exception instanceof APIError
          ? getVkApiErrorMethod(exception)
          : undefined;
      this.logger.error(
        `OnUpdateType(${ctx?.type})${apiMethod ? ` [VK API: ${apiMethod}]` : ''}: ${exception?.message || exception}`,
        exception.stack,
      );
    }

    if (isCCE) {
      this.logger.warn(
        `[Concurrency][VK] updateType=${ctx?.type} peer=${ctx?.peerId ?? 'unknown'} ${exception.name}; key=${exception.key ?? 'unknown'}`,
      );
    }

    if (
      !(exception instanceof Error) ||
      !(ctx.answer || ctx.reply) ||
      exception instanceof ForbiddenException ||
      // * One of the parameters specified was missing or invalid
      (exception instanceof APIError && exception.code == APIErrorCode.PARAM)
    ) {
      return;
    }

    const isAdmin =
      xEnv.SOCIAL_VK_ADMIN_IDS.includes(ctx.senderId || ctx.peerId) ||
      ctx.state.user?.role === 'admin';
    let content = '';
    switch (true) {
      case exception instanceof UserException:
        content = `💢 Error: ${exception.message}`;
        break;
      case exception.message === LocalePhrase.Common_NoAccess:
        content = ctx.i18n.t(LocalePhrase.Common_NoAccess);
        break;
      case isCCE:
        content = ctx.i18n.t(
          isCooldownError(exception)
            ? LocalePhrase.Common_RequestQueueFull
            : LocalePhrase.Common_RequestBusy,
        );
        break;

      case isAdmin:
        content = `💢 Error: ${exception.message}`;
        break;

      default:
        content = ctx.i18n.t(LocalePhrase.Common_Error);
        break;
    }

    if (exception instanceof APIError) {
      if (isVkRateLimitError(exception)) {
        // ?.. set to session ratelimit info?
        return;
      }

      if (ctx.isChat && isVkConversationUnavailableError(exception)) {
        try {
          if (ctx.state.conversation) {
            ctx.state.conversation.isLeaved = true;
            if (/kicked out of the conversation/i.test(exception.message)) {
              ctx.state.conversation.chatStatus = 'kicked';
            }
          }
        } catch (err) {
          if (err instanceof Error) {
            this.logger.error(
              '[ConversationUnavailable] Failed to mark conversation as leaved',
              err.stack,
            );
          } else {
            this.logger.error(
              `[ConversationUnavailable] Failed to mark conversation as leaved: ${String(err)}`,
            );
          }
        }
        return;
      }

      if (ctx.isDM && isVkUserUnavailableError(exception)) {
        try {
          ctx.state.userSocial.isBlockedBot = true;
          // ctx.session.isBlockedBot = true;
        } catch (err) {
          if (err instanceof Error) {
            this.logger.error(
              '[UserUnavailable] Failed to mark userSocial as blocked',
              err.stack,
            );
          } else {
            this.logger.error(
              `[UserUnavailable] Failed to mark userSocial as blocked: ${String(err)}`,
            );
          }
        }
        return;
      }
    }

    try {
      if (ctx.eventPayload && ctx.answer && !ctx.state.eventAnswered) {
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
