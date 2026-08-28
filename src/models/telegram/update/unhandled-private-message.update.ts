import { Ctx, On, Update } from '@xtcry/nestjs-telegraf';

import { AllowedChatTypes } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/telegram';

import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';

/** Отвечает на необработанные текстовые сообщения в личных чатах. */
@Update()
export class UnhandledPrivateMessageUpdate {
  constructor(private readonly keyboardFactory: TelegramKeyboardFactory) {}

  @On('text')
  @AllowedChatTypes('private')
  async onUnhandledPrivateMessage(@Ctx() ctx: IMessageContext) {
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_UnknownMessage),
      this.keyboardFactory.getStart(ctx),
    );
  }
}
