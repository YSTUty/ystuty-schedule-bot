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
  BroadcastFeedbackButton,
  getBroadcastFeedbackAfterClickMode,
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
        result.feedbackButton,
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
   * Для вложений, которые API позволяет передать повторно, сохраняем их при
   * смене keyboard. У стикера отсутствует сериализуемый attachment для
   * `messages.edit`, поэтому очищаем keyboard отдельным API-вызовом.
   */
  private async replaceInitialFeedbackButton(
    ctx: IMessageEventContext,
    deliveryId: number,
    feedbackButton: BroadcastFeedbackButton,
    actionKeyboard?: BroadcastActionKeyboard | null,
  ) {
    const source = await ctx.api.messages.getByConversationMessageId({
      peer_id: ctx.peerId,
      conversation_message_ids: ctx.conversationMessageId,
    });
    const sourceMessage = source.items[0];
    if (!sourceMessage) {
      return;
    }
    const attachments = Array.isArray(sourceMessage.attachments)
      ? sourceMessage.attachments
      : [];
    const attachment = this.serializeSourceAttachments(attachments);
    const afterClickMode = getBroadcastFeedbackAfterClickMode(feedbackButton);
    if (!sourceMessage.text && !attachment && attachments.length) {
      if (afterClickMode === 'delete') {
        await ctx.api.messages.edit({
          peer_id: ctx.peerId,
          cmid: ctx.conversationMessageId,
          keyboard: JSON.stringify({ buttons: [], inline: true }),
        });
      }
      return;
    }

    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      ...(sourceMessage.text ? { message: sourceMessage.text } : {}),
      ...(attachment ? { attachment } : {}),
      // Не удаляем пересланные сообщения и сниппеты, когда меняется только keyboard.
      keep_forward_messages: 1,
      keep_snippets: 1,
      keyboard: this.keyboardFactory
        .getBroadcastRecipientKeyboard({
          deliveryId,
          actionKeyboard,
          feedbackAction: 'repeat',
          feedbackButton:
            afterClickMode === 'delete'
              ? null
              : {
                  text:
                    afterClickMode === 'replace'
                      ? feedbackButton.afterClickText || feedbackButton.text
                      : feedbackButton.text,
                },
        })
        .inline(),
    });
  }

  /** Преобразует вложения API VK, которые можно без потери приложить повторно. */
  private serializeSourceAttachments(attachments: unknown): string | null {
    if (!Array.isArray(attachments)) return null;

    const values = attachments.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];

      const typedItem = item as Record<string, unknown>;
      const type = typedItem.type;
      if (typeof type !== 'string') return [];

      const payload = typedItem[type];
      if (!payload || typeof payload !== 'object') return [];

      const {
        id,
        owner_id: ownerId,
        access_key: accessKey,
      } = payload as {
        id?: unknown;
        owner_id?: unknown;
        access_key?: unknown;
      };
      if (typeof id !== 'number' || typeof ownerId !== 'number') return [];

      return [
        `${type}${ownerId}_${id}${typeof accessKey === 'string' ? `_${accessKey}` : ''}`,
      ];
    });

    return values.length ? values.join(',') : null;
  }
}
