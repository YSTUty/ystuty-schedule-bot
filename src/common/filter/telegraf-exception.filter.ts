import { Catch, ExceptionFilter, Logger } from '@nestjs/common';
import {
  TelegrafArgumentsHost,
  TelegrafExecutionContext,
} from '@xtcry/nestjs-telegraf';
import { TelegramError } from 'telegraf';
import * as Redlock from 'redlock';

import * as xEnv from '@my-environment';
import { UserException, escapeHTMLCodeChars } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

@Catch()
export class TelegrafExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TelegrafExceptionFilter.name);

  async catch(exception: Error, host: TelegrafExecutionContext): Promise<void> {
    if (host.getType() !== 'telegraf') {
      return;
    }

    const telegrafHost = TelegrafArgumentsHost.create(host);
    const ctx = telegrafHost.getContext<IContext>();

    if (
      exception.message !== LocalePhrase.Common_NoAccess &&
      !(exception instanceof Redlock.LockError)
    ) {
      this.logger.error(
        `OnUpdateType(${ctx?.updateType}): ${exception?.message || exception}`,
        exception.stack,
      );
    }

    if (!(exception instanceof Error) || !ctx) {
      return;
    }

    const isAdmin = xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id);
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
      case exception instanceof Redlock.LockError:
        content = ctx.i18n.t(LocalePhrase.Common_Cooldown);
        break;

      case isAdmin:
        content = ctx.callbackQuery
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
      if (
        exception.description.includes('bot was blocked by the user') ||
        exception.description.includes('user is deactivated') ||
        exception.description.includes('chat not found')
      ) {
        try {
          ctx.userSocial.isBlockedBot = true;
        } catch (err) {
          console.error(err);
        }
        return;
      }
    }

    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(content, { show_alert: isAdmin });
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
