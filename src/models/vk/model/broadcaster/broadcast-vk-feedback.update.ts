import { UseFilters } from '@nestjs/common';
import { Ctx, OnMessageEvent, Update } from 'nestjs-vk';

import { Keyboard } from 'vk-io';

import { VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IMessageEventContext } from '@my-interfaces/vk';

import { BroadcastService } from '../../../broadcast/broadcast.service';
import { BroadcastFeedbackAction } from '../../../broadcast/broadcast.types';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

/** Обрабатывает feedback получателей без требования прав администратора. */
@Update()
@UseFilters(VkExceptionFilter)
export class BroadcastVkFeedbackUpdate {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @OnMessageEvent((payload) =>
    ['initial', 'repeat'].includes(String(payload.broadcastFeedbackAction)),
  )
  async onBroadcastFeedback(@Ctx() ctx: IMessageEventContext) {
    const action = ctx.eventPayload
      .broadcastFeedbackAction as BroadcastFeedbackAction;
    const result = await this.broadcastService.recordCampaignFeedback({
      deliveryId: Number(ctx.eventPayload.deliveryId),
      social: SocialType.Vkontakte,
      userSocialId: ctx.state.userSocial?.id,
      action,
    });
    if (result?.created && action === 'initial') {
      await ctx.api.messages.edit({
        peer_id: ctx.peerId,
        cmid: ctx.conversationMessageId,
        keyboard: result.feedbackButton.afterClickText
          ? this.keyboardFactory
              .getBroadcastFeedbackButton(
                result.feedbackButton.afterClickText,
                Number(ctx.eventPayload.deliveryId),
                'repeat',
              )
              .inline()
          : Keyboard.keyboard([]).inline(),
      });
    }
    const responseText = !result
      ? ctx.i18n.t(LocalePhrase.Broadcast_Notification_FeedbackUnavailable)
      : result.created
        ? result.feedbackButton.responseText ||
          ctx.i18n.t(LocalePhrase.Broadcast_Notification_FeedbackReceived)
        : ctx.i18n.t(
            LocalePhrase.Broadcast_Notification_FeedbackAlreadyReceived,
          );
    await ctx.answer({
      type: 'show_snackbar',
      text: responseText,
    });
  }
}
