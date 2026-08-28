import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectBot } from '@xtcry/nestjs-telegraf';

import { Telegraf } from 'telegraf';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';

/** Регистрирует fallback после всех decorator-based Telegram listeners. */
@Injectable()
export class UnhandledPrivateMessageMiddleware implements OnApplicationBootstrap {
  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {}

  public onApplicationBootstrap() {
    // @xtcry/nestjs-telegraf регистрирует @On('text') раньше этого lifecycle hook.
    // Поэтому fallback не перехватывает совпавшие команды и кнопки reply keyboard.
    this.bot.on('text', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;

      const context = ctx as IContext;
      await context.replyWithHTML(
        context.i18n.t(LocalePhrase.Page_UnknownMessage),
        this.keyboardFactory.getStart(context),
      );
    });
  }
}
