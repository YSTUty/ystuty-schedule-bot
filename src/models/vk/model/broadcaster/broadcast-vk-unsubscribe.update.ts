import { UseFilters } from '@nestjs/common';
import { Ctx, Hears, OnMessageEvent, Update } from 'nestjs-vk';

import { Keyboard } from 'vk-io';

import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { UserService } from '../../../user/user.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

/** Отдельный flow отключения и восстановления персональных рассылок. */
@Update()
@UseFilters(VkExceptionFilter)
export class BroadcastVkUnsubscribeUpdate {
  constructor(
    private readonly userService: UserService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @Hears(['/unsubscribe', 'отписаться', 'больше не студент'])
  async onUnsubscribeCommand(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM) return;

    await this.showConfirmation(ctx);
  }

  @OnMessageEvent(
    (payload) =>
      payload.broadcastUnsubscribe === 'confirm' ||
      payload.broadcastUnsubscribe === 'cancel',
  )
  async onConfirmation(@Ctx() ctx: IMessageEventContext) {
    if (!ctx.isDM) {
      await ctx.answer({ type: 'show_snackbar', text: 'Недоступно в беседе' });
      return;
    }

    if (ctx.eventPayload.broadcastUnsubscribe === 'confirm') {
      await this.userService.disableBroadcasts(ctx.state.userSocial);
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Unsubscribed),
      });
      await ctx.api.messages.edit({
        peer_id: ctx.peerId,
        cmid: ctx.conversationMessageId,
        message: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Unsubscribed),
        keyboard: Keyboard.keyboard([]).inline(),
      });
      return;
    }

    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(LocalePhrase.Common_Canceled),
    });
    await ctx.deleteMessage({ delete_for_all: true });
  }

  public async showConfirmation(ctx: IMessageContext | IMessageEventContext) {
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_UnsubscribeConfirm), {
      keyboard: this.keyboardFactory
        .getBroadcastUnsubscribeConfirmation(ctx)
        .inline(),
    });
  }
}
