import { Injectable, UseFilters } from '@nestjs/common';
import { Ctx, ListenerPhase, On, Update } from 'nestjs-telega';

import { TelegrafExceptionFilter } from '@my-common';
import { AllowedChatTypes } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/telegram';

import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';

/** Отвечает на текст, который не обработали основные Telegram-listener-ы. */
@Injectable()
@Update()
@UseFilters(TelegrafExceptionFilter)
export class UnhandledPrivateMessageMiddleware {
  constructor(private readonly keyboardFactory: TelegramKeyboardFactory) {}

  /**
   * Fallback-фаза гарантирует регистрацию после обычных обработчиков во всех
   * модулях, сохраняя для них возможность остановить цепочку через отсутствие next().
   */
  @ListenerPhase('fallback')
  @On('text')
  @AllowedChatTypes('private')
  async onUnhandledPrivateMessage(@Ctx() ctx: IMessageContext) {
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_UnknownMessage),
      this.keyboardFactory.getUnknownMessageHelp(ctx),
    );
  }
}
