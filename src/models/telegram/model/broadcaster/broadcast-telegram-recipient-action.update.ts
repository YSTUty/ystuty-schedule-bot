import { UseFilters } from '@nestjs/common';
import { Action, Ctx, Update } from '@xtcry/nestjs-telegraf';

import { TelegrafExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext } from '@my-interfaces/telegram';

import { BroadcastService } from '../../../broadcast/broadcast.service';
import { BroadcastRecipientAction } from '../../../broadcast/broadcast.types';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../../telegram.constants';

/** Обрабатывает предустановленные действия получателей без требования прав администратора. */
@Update()
@UseFilters(TelegrafExceptionFilter)
export class BroadcastTelegramRecipientActionUpdate {
  constructor(private readonly broadcastService: BroadcastService) {}

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
        await ctx.scene.enter(SELECT_GROUP_SCENE);
        return;
      case 'auth':
        await ctx.scene.enter(AUTH_SCENE);
        return;
    }
  }
}
