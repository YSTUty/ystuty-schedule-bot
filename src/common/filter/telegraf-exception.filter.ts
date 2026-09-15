import { Catch, ExceptionFilter, Logger } from '@nestjs/common';
import {
  TelegrafArgumentsHost,
  TelegrafException,
  TelegrafExecutionContext,
} from 'nestjs-telega';

import { TelegramError } from 'telegraf-hardened';

import * as xEnv from '@my-environment';

import {
  escapeHTMLCodeChars,
  isConcurrencyControlError,
  isCooldownError,
  UserException,
} from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { getTransportErrorHandlerLabel } from './transport-exception-context.util';

export const isTelegramUserUnavailableError = (exception: TelegramError) =>
  exception.description.includes('bot was blocked by the user') ||
  exception.description.includes('user is deactivated');

/** Telegram не уточняет тип чата в этой ошибке, его определяет вызывающий контекст. */
export const isTelegramChatNotFoundError = (exception: TelegramError) =>
  exception.description.includes('chat not found');

export const isTelegramConversationUnavailableError = (
  exception: TelegramError,
) =>
  exception.description.includes('bot was kicked from the group chat') ||
  exception.description.includes('bot was kicked from the supergroup chat') ||
  exception.description.includes(
    'bot is not a member of the supergroup chat',
  ) ||
  isTelegramChatNotFoundError(exception);

export const isTelegramRateLimitError = (exception: TelegramError) =>
  exception.code === 429 || exception.description.includes('Too Many Requests');

/** Ошибки API, которые штатно обрабатываются filter-ом без error-лога. */
export const isExpectedTelegramTransportError = (exception: Error) =>
  exception instanceof TelegramError &&
  (isTelegramUserUnavailableError(exception) ||
    isTelegramConversationUnavailableError(exception) ||
    isTelegramRateLimitError(exception));

@Catch()
export class TelegrafExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TelegrafExceptionFilter.name);

  async catch(exception: Error, host: TelegrafExecutionContext): Promise<void> {
    if (host.getType() !== 'telegraf') {
      return;
    }

    const telegrafHost = TelegrafArgumentsHost.create(host);
    const ctx = telegrafHost.getContext<IContext>();
    const next = telegrafHost.getNext<() => Promise<void>>();
    const isCCE = isConcurrencyControlError(exception);

    if (
      exception instanceof TelegrafException &&
      (exception.message === 'SKIP_FULL' || exception.message === 'SKIP')
    ) {
      await next?.();
      return;
    }

    if (
      exception.message !== LocalePhrase.Common_NoAccess &&
      !isCCE &&
      !isExpectedTelegramTransportError(exception)
    ) {
      const handler = getTransportErrorHandlerLabel(host);
      const messageId =
        ctx?.callbackQuery?.message?.message_id ?? ctx?.message?.message_id;
      this.logger.error(
        `OnUpdateType(${ctx?.updateType}) [handler=${handler}] [chat=${ctx?.chat?.id ?? 'unknown'} user=${ctx?.from?.id ?? 'unknown'} message=${messageId ?? 'unknown'}]: ${exception?.message || exception}`,
        exception.stack,
      );
    }

    if (isCCE) {
      this.logger.warn(
        `[Concurrency][TG] updateType=${ctx?.updateType} user=${ctx?.from?.id ?? 'unknown'} ${exception.name}; key=${exception.key ?? 'unknown'}`,
      );
    }

    if (!(exception instanceof Error) || !ctx) {
      return;
    }

    const isAdmin =
      ctx.from && xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id);
    let content = '';
    switch (true) {
      case exception instanceof UserException:
        content = ctx.callbackQuery
          ? `💢 Error: ${escapeHTMLCodeChars(exception.message)}`
          : `💢 Error: <b>${escapeHTMLCodeChars(exception.message)}</b>`;
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
        content =
          ctx.callbackQuery || !exception.stack
            ? `💢 Error: ${escapeHTMLCodeChars(exception.message)}`
            : `💢 Error: <b>${escapeHTMLCodeChars(
                exception.message,
              )}</b>\n<code>${escapeHTMLCodeChars(
                exception.stack.split('\n').slice(0, 5).join('\n'),
              )}</code>`;
        break;

      default:
        content = ctx.i18n.t(LocalePhrase.Common_Error);
        break;
    }

    if (exception instanceof TelegramError) {
      const isPrivateChat = ctx.chat?.type === 'private';
      const isUserUnavailable =
        isTelegramUserUnavailableError(exception) ||
        (isPrivateChat && isTelegramChatNotFoundError(exception));
      const isConversationUnavailable =
        !isPrivateChat && isTelegramConversationUnavailableError(exception);

      if (isUserUnavailable) {
        try {
          ctx.userSocial.isBlockedBot = true;
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

      if (isConversationUnavailable) {
        try {
          if (ctx.conversation) {
            ctx.conversation.isLeaved = true;
            ctx.conversation.chatStatus = 'kicked';
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

      if (isTelegramRateLimitError(exception)) {
        return;
      }
    }

    try {
      if (ctx.callbackQuery) {
        await ctx.tryAnswerCbQuery(content, { show_alert: isAdmin });
      } else {
        await ctx.replyWithHTML(content, {
          ...(ctx.message?.message_id && {
            reply_parameters: {
              message_id: ctx.message.message_id,
              allow_sending_without_reply: true,
            },
          }),
        });
      }
    } catch {}
  }
}
