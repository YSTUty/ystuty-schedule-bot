import { UseFilters, UseGuards } from '@nestjs/common';
import { Action, Command, Ctx, Update } from '@xtcry/nestjs-telegraf';

import { TelegrafExceptionFilter, TelegramAdminGuard } from '@my-common';
import { SocialType } from '@my-common/constants';
import { TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import {
  ICallbackQueryContext,
  IMessageContext,
} from '@my-interfaces/telegram';

import { TELEGRAM_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

@Update()
@UseFilters(TelegrafExceptionFilter)
@UseGuards(new TelegramAdminGuard(true))
export class BroadcastTelegramUpdate {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {}

  @Command('broadcast')
  @TgHearsLocale(LocalePhrase.Button_Broadcast)
  async onBroadcast(@Ctx() ctx: IMessageContext) {
    if (ctx.chat.type !== 'private') {
      return ctx.i18n.t(LocalePhrase.Page_Broadcast_PrivateOnly);
    }

    await ctx.scene.enter(TELEGRAM_BROADCAST_SCENE);
  }

  @Command('broadcast_status')
  async onBroadcastStatus(@Ctx() ctx: IMessageContext) {
    const status = await this.broadcastService.getQueueStatus(
      SocialType.Telegram,
    );
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      status.hasPending
        ? this.keyboardFactory.getBroadcastQueueControls(ctx, status.paused)
        : undefined,
    );
  }

  @Command('broadcast_terminate')
  async onBroadcastTerminate(@Ctx() ctx: IMessageContext) {
    await this.broadcastService.terminateActiveCampaigns(SocialType.Telegram);
    await ctx.replyWithHTML('Active broadcast queue terminated.');
  }

  @Action(/broadcast:queue:(?<action>pause|resume|terminate)/)
  async onQueueAction(@Ctx() ctx: ICallbackQueryContext) {
    const action = ctx.match!.groups!.action;

    if (action === 'pause') {
      await this.broadcastService.pauseQueue(SocialType.Telegram);
      await ctx.tryAnswerCbQuery('Рассылка приостановлена');
    }
    if (action === 'resume') {
      await this.broadcastService.resumeQueue(SocialType.Telegram);
      await ctx.tryAnswerCbQuery('Рассылка продолжена');
    }
    if (action === 'terminate') {
      await this.broadcastService.terminateActiveCampaigns(SocialType.Telegram);
      await ctx.tryAnswerCbQuery('Рассылка остановлена');
    }

    const status = await this.broadcastService.getQueueStatus(
      SocialType.Telegram,
    );
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      {
        parse_mode: 'HTML',
        ...(!status.hasPending || action === 'terminate'
          ? {}
          : this.keyboardFactory.getBroadcastQueueControls(ctx, status.paused)),
      },
    );
  }
}
