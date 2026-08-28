import { UseFilters } from '@nestjs/common';
import { Ctx, OnMessageEvent, Update } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IMessageEventContext } from '@my-interfaces/vk';

import { BroadcastService } from '../../../broadcast/broadcast.service';
import { BroadcastRecipientAction } from '../../../broadcast/broadcast.types';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../../vk.constants';

/** Обрабатывает предустановленные действия получателей без требования прав администратора. */
@Update()
@UseFilters(VkExceptionFilter)
export class BroadcastVkRecipientActionUpdate {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @OnMessageEvent(
    (payload) =>
      typeof payload.broadcastRecipientAction === 'string' &&
      Number.isSafeInteger(Number(payload.deliveryId)),
  )
  async onRecipientAction(@Ctx() ctx: IMessageEventContext) {
    const actionKeyboard =
      await this.broadcastService.getCampaignRecipientAction({
        deliveryId: Number(ctx.eventPayload.deliveryId),
        social: SocialType.Vkontakte,
        userSocialId: ctx.state.userSocial?.id,
        action: ctx.eventPayload
          .broadcastRecipientAction as BroadcastRecipientAction,
      });
    if (!actionKeyboard) {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_ActionUnavailable),
      });
      return;
    }

    await this.runRecipientAction(ctx, actionKeyboard.type);
    await ctx.answer({ type: 'show_snackbar', text: 'Готово' });
  }

  /** Transport-адаптер действий кампании; доступ проверяется до вызова. */
  private async runRecipientAction(
    ctx: IMessageEventContext,
    action: BroadcastRecipientAction,
  ) {
    switch (action) {
      case 'select_group':
        await ctx.scene.enter(SELECT_GROUP_SCENE, {
          state: { forceNewMessage: true },
        });
        return;
      case 'auth':
        await ctx.scene.enter(AUTH_SCENE, {
          state: { forceNewMessage: true },
        });
        return;
      case 'start':
        await ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), {
          keyboard: this.keyboardFactory
            .getStart(ctx)
            .inline(this.keyboardFactory.needInline(ctx)),
        });
        await ctx.send(ctx.i18n.t(LocalePhrase.Page_WelcomeFeatures), {
          keyboard: this.keyboardFactory.getWelcomeFeatures(ctx).inline(),
        });
        return;
    }
  }
}
