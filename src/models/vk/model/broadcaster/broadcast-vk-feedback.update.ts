import { UseFilters } from '@nestjs/common';
import { Ctx, OnMessageEvent, Update } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IMessageEventContext } from '@my-interfaces/vk';

import { BroadcastService } from '../../../broadcast/broadcast.service';
import {
  BroadcastActionKeyboard,
  BroadcastFeedbackAction,
} from '../../../broadcast/broadcast.types';
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
    if (result && action === 'initial') {
      await this.replaceInitialFeedbackButton(
        ctx,
        Number(ctx.eventPayload.deliveryId),
        result.feedbackButton.afterClickText,
        result.actionKeyboard,
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
    await ctx.answer({
      type: 'show_snackbar',
      text: responseText,
    });
  }

  /**
   * VK API требует передавать текст или attachment даже при смене клавиатуры.
   * Поэтому сначала читаем исходное сообщение и сохраняем его текст.
   */
  private async replaceInitialFeedbackButton(
    ctx: IMessageEventContext,
    deliveryId: number,
    afterClickText?: string | null,
    actionKeyboard?: BroadcastActionKeyboard | null,
  ) {
    const source = await ctx.api.messages.getByConversationMessageId({
      peer_id: ctx.peerId,
      conversation_message_ids: ctx.conversationMessageId,
    });
    const message = source.items[0]?.text;
    if (!message) {
      throw new Error('VK feedback message is empty or unavailable');
    }

    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message,
      keyboard: this.keyboardFactory
        .getBroadcastRecipientKeyboard({
          deliveryId,
          actionKeyboard,
          feedbackAction: 'repeat',
          feedbackButton: afterClickText ? { text: afterClickText } : null,
        })
        .inline(),
    });
  }
}
