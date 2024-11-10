import { Injectable } from '@nestjs/common';
import { MiddlewareObj } from 'telegraf/typings/middleware';

import { SOCIAL_TELEGRAM_BOT_NAME } from '@my-environment';
import { IContext } from '@my-interfaces/telegram';
import { i18n } from '@my-common/util/tg';

@Injectable()
export class MainMiddleware implements MiddlewareObj<IContext> {
  public get middlewareForkAll() {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      next();
    };
  }

  public middleware() {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      // TODO: remove after test
      if (!ctx.from) {
        console.log(
          'Empty ctx.from from ctx',
          { updateType: ctx.updateType },
          ctx.update,
        );
      }
      if (ctx.from?.is_bot) return;

      ctx.tryAnswerCbQuery = (...args) =>
        ctx.updateType === 'callback_query' && ctx.answerCbQuery?.(...args);

      this.checkInGroupAppeal(ctx);

      try {
        await next?.();
      } catch (err: unknown) {
        console.log('[MainMiddleware] Error', err);
        throw err;
      }
    };
  }

  public middlewareCleaner(after = false) {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      if (!after) {
        this.cleanSession(ctx, true);
      }
      const res = await next?.();
      this.cleanSession(ctx);
      return res;
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

  private cleanSession(ctx: IContext, revert = false) {
    const { session } = ctx;
    if (!session) return;

    // Scene
    if (revert) {
      // ? why?
      // session['__scenes'] = {};
    } else if (
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

  public get i18nMiddleware() {
    return async (ctx: IContext, next: Function) => {
      const session: IContext['session'] =
        i18n.config.useSession && ctx[i18n.config.sessionName];
      const languageCode =
        session?.__language_code ??
        ctx.from?.language_code ??
        i18n.config.defaultLanguage;

      ctx.i18n = i18n.createContext(languageCode, {
        // * Put `ctx`
        ctx,
        from: ctx.from,
        chat: ctx.chat,
      }) as any;

      await next();

      if (session) {
        session.__language_code = ctx.i18n.locale();
      }
    };
  }
}
