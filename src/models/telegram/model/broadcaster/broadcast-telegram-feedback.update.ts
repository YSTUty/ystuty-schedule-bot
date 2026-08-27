import { UseFilters } from '@nestjs/common';
import { Action, Ctx, Update } from '@xtcry/nestjs-telegraf';

import { TelegrafExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext } from '@my-interfaces/telegram';

import { BroadcastService } from '../../../broadcast/broadcast.service';
import { BroadcastFeedbackAction } from '../../../broadcast/broadcast.types';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

/** Обрабатывает feedback получателей без требования прав администратора. */
@Update()
@UseFilters(TelegrafExceptionFilter)
export class BroadcastTelegramFeedbackUpdate {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {}

  @Action(/broadcast:feedback:(?<deliveryId>\d+):(?<action>initial|repeat)/)
  async onBroadcastFeedback(@Ctx() ctx: ICallbackQueryContext) {
    const { deliveryId, action } = ctx.match!.groups!;
    const result = await this.broadcastService.recordCampaignFeedback({
      deliveryId: Number(deliveryId),
      social: SocialType.Telegram,
      userSocialId: ctx.userSocial?.id,
      action: action as BroadcastFeedbackAction,
    });
    if (result?.created && action === 'initial') {
      await ctx.editMessageReplyMarkup(
        this.keyboardFactory.getBroadcastRecipientKeyboard({
          deliveryId: Number(deliveryId),
          actionKeyboard: result.actionKeyboard,
          feedbackAction: 'repeat',
          feedbackButton: result.feedbackButton.afterClickText
            ? {
                ...result.feedbackButton,
                text: result.feedbackButton.afterClickText,
              }
            : null,
        }).reply_markup,
      );
    }
    const responseText = !result
      ? ctx.i18n.t(LocalePhrase.Broadcast_Notification_FeedbackUnavailable)
      : result.created
        ? result.feedbackButton.responseText ||
          ctx.i18n.t(LocalePhrase.Broadcast_Notification_FeedbackReceived)
        : ctx.i18n.t(
            LocalePhrase.Broadcast_Notification_FeedbackAlreadyReceived,
          );
    await ctx.tryAnswerCbQuery(responseText);
  }
}
