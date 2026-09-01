import { UseFilters } from '@nestjs/common';
import { Action, Ctx, Update } from 'nestjs-telega';

import { TelegrafExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext } from '@my-interfaces/telegram';

import { BroadcastService } from '../../../broadcast/broadcast.service';
import { BroadcastRecipientAction } from '../../../broadcast/broadcast.types';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../../telegram.constants';

import { BroadcastTelegramUnsubscribeUpdate } from './broadcast-telegram-unsubscribe.update';

/** Обрабатывает предустановленные действия получателей без требования прав администратора. */
@Update()
@UseFilters(TelegrafExceptionFilter)
export class BroadcastTelegramRecipientActionUpdate {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly unsubscribeUpdate?: BroadcastTelegramUnsubscribeUpdate,
  ) {}

  @Action(/broadcast:action:(?<deliveryId>\d+):(?<action>[a-z_]+)/)
  async onRecipientAction(@Ctx() ctx: ICallbackQueryContext) {
    const { deliveryId, action } = ctx.match!.groups!;
    const actionKeyboard =
      await this.broadcastService.getCampaignRecipientAction({
        deliveryId: Number(deliveryId),
        social: SocialType.Telegram,
        userSocialId: ctx.userSocial?.id,
        action: action as BroadcastRecipientAction,
      });
    if (!actionKeyboard) {
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Broadcast_Notification_ActionUnavailable),
      );
      return;
    }

    await this.runRecipientAction(ctx, actionKeyboard.type);
    await ctx.tryAnswerCbQuery();
  }

  /** Transport-адаптер действий кампании; доступ проверяется до вызова. */
  private async runRecipientAction(
    ctx: ICallbackQueryContext,
    action: BroadcastRecipientAction,
  ) {
    switch (action) {
      case 'select_group':
        await ctx.scene.enter(SELECT_GROUP_SCENE, {
          forceNewMessage: true,
        });
        return;
      case 'auth':
        await ctx.scene.enter(AUTH_SCENE, { forceNewMessage: true });
        return;
      case 'start':
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_Start),
          this.keyboardFactory.getStart(ctx),
        );
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_WelcomeFeatures),
          this.keyboardFactory.getWelcomeFeatures(ctx),
        );
        return;
      case 'unsubscribe':
        await this.unsubscribeUpdate?.showConfirmation(ctx);
        return;
    }
  }
}
