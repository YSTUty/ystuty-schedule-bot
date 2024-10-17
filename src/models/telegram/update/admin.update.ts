import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Action, Command, Ctx, Update } from '@xtcry/nestjs-telegraf';

import {
  SocialType,
  TelegrafExceptionFilter,
  TelegramAdminGuard,
} from '@my-common';
import {
  ICallbackQueryContext,
  IMessageContext,
} from '@my-interfaces/telegram';

import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { UserService } from '../../user/user.service';

@Update()
@UseGuards(new TelegramAdminGuard(true))
@UseFilters(TelegrafExceptionFilter)
export class AdminUpdate {
  private readonly logger = new Logger(AdminUpdate.name);

  constructor(
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly userService: UserService,
  ) {}

  @Command('sendmsg')
  async onSendMessage(@Ctx() ctx: IMessageContext) {
    const { message } = ctx;

    if (!('text' in message)) {
      return 'Need text message';
    }

    const [, socialIdsStr, ...btnTextAr] = message.text.split(' ');
    const btnText = btnTextAr.join(' ') || null;

    const socialIds = socialIdsStr
      ?.split(',')
      .map((e) => Math.round(+e))
      .filter(Boolean);
    if (!socialIds || !socialIds.length) {
      return 'Need set social id in arg';
    }
    if (socialIds.length > 15) {
      return 'Max 15 social ids';
    }

    if (!('reply_to_message' in message)) {
      return 'Need reply message';
    }

    const { reply_to_message } = message;
    if (!('text' in reply_to_message)) {
      return 'Need reply message with text';
    }

    const userSocials = await this.userService.findBySocialIds(
      SocialType.Telegram,
      socialIds,
    );
    if (!userSocials.length) {
      return 'Users social not found';
    }
    for (const userSocial of userSocials) {
      // const res = await ctx.telegram.sendMessage(
      //   userSocial.socialId,
      //   reply_to_message.text,
      //   { entities: reply_to_message.entities },
      // );
      const res = await ctx.telegram.copyMessage(
        userSocial.socialId,
        reply_to_message.chat.id,
        reply_to_message.message_id,
        btnText
          ? this.keyboardFactory.getActioner(
              ctx,
              [{ title: btnText, payload: `callback` }],
              'sendmsg:',
            )
          : undefined,
      );

      const keyboard = this.keyboardFactory.getActioner(
        ctx,
        [
          {
            title: 'Remove',
            payload: `remove:${userSocial.socialId /* res.chat.id */}:${
              res.message_id
            }`,
          },
        ],
        'sendmsg:',
      );
      await ctx.replyWithHTML(
        // `Sent: <code>${JSON.stringify(res, null, 2)}</code>`,
        `Sent: <code>${res.message_id}</code> for %${userSocial.socialId} @${
          userSocial.username || '-'
        }`,
        keyboard,
      );
    }
  }

  @Action(/sendmsg:remove:(?<chatId>[0-9]+):(?<message_id>[0-9]+)/)
  async onNopeAction(@Ctx() ctx: ICallbackQueryContext) {
    const chatId = Number(ctx.match.groups.chatId);
    const messageId = Number(ctx.match.groups.message_id);
    if (!chatId || !messageId) {
      await ctx.tryAnswerCbQuery('Wrong payload');
      return;
    }
    try {
      await ctx.telegram.deleteMessage(chatId, messageId);
      await ctx.tryAnswerCbQuery('Removed');
    } catch (err) {
      await ctx.tryAnswerCbQuery('Wrong: ' + err.message, { show_alert: true });
    }
    await ctx.editMessageReplyMarkup(
      this.keyboardFactory.getClear().reply_markup,
    );
  }
}
