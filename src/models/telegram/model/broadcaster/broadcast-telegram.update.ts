import { UseFilters, UseGuards } from '@nestjs/common';
import { Command, Ctx, Hears, Update } from '@xtcry/nestjs-telegraf';

import { TelegrafExceptionFilter, TelegramAdminGuard } from '@my-common';
import { IMessageContext } from '@my-interfaces/telegram';

import { TELEGRAM_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';

@Update()
@UseFilters(TelegrafExceptionFilter)
@UseGuards(new TelegramAdminGuard(true))
export class BroadcastTelegramUpdate {
  constructor(private readonly broadcastService: BroadcastService) {}

  // TODO(broadcast): move command text to i18n when broadcast phrases are added.
  @Command('broadcast')
  @Hears('Рассылки')
  async onBroadcast(@Ctx() ctx: IMessageContext) {
    if (ctx.chat.type !== 'private') {
      return 'Broadcast wizard is available only in private chat';
    }

    await ctx.scene.enter(TELEGRAM_BROADCAST_SCENE);
  }

  @Command('broadcast_status')
  async onBroadcastStatus(@Ctx() ctx: IMessageContext) {
    const status = await this.broadcastService.getQueueStatus();
    await ctx.replyWithHTML(
      [
        '<b>Broadcast queue</b>',
        `Active: <code>${status.active}</code>`,
        `Waiting: <code>${status.waiting}</code>`,
        `Delayed: <code>${status.delayed}</code>`,
        `Completed: <code>${status.completed}</code>`,
        `Failed: <code>${status.failed}</code>`,
      ].join('\n'),
    );
  }

  @Command('broadcast_terminate')
  async onBroadcastTerminate(@Ctx() ctx: IMessageContext) {
    await this.broadcastService.terminateActiveCampaigns();
    await ctx.replyWithHTML('Active broadcast queue terminated.');
  }
}
