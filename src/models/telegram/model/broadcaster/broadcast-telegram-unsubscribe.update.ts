import { UseFilters } from '@nestjs/common';
import { Action, Command, Ctx, Hears, Update } from 'nestjs-telega';

import { TelegrafExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import {
  ICallbackQueryContext,
  IMessageContext,
} from '@my-interfaces/telegram';

import { UserService } from '../../../user/user.service';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

/** Отдельный flow отключения и восстановления персональных рассылок. */
@Update()
@UseFilters(TelegrafExceptionFilter)
export class BroadcastTelegramUnsubscribeUpdate {
  constructor(
    private readonly userService: UserService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {}

  @Command('unsubscribe')
  @Hears(['отписаться', 'больше не студент'])
  async onUnsubscribeCommand(@Ctx() ctx: IMessageContext) {
    if (ctx.chat.type !== 'private') return;

    await this.showConfirmation(ctx);
  }

  @Action('broadcast:unsubscribe:confirm')
  async onConfirm(@Ctx() ctx: ICallbackQueryContext) {
    if (ctx.chat?.type !== 'private' || !ctx.userSocial) return;

    await this.userService.disableBroadcasts(ctx.userSocial);
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Broadcast_Notification_Unsubscribed),
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      },
    );
  }

  @Action('broadcast:unsubscribe:cancel')
  async onCancel(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.tryAnswerCbQuery(ctx.i18n.t(LocalePhrase.Common_Canceled));
    await ctx.deleteMessage();
  }

  public async showConfirmation(ctx: IMessageContext | ICallbackQueryContext) {
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_UnsubscribeConfirm),
      this.keyboardFactory.getBroadcastUnsubscribeConfirmation(ctx),
    );
  }
}
