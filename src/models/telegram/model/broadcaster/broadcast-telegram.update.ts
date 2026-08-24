import { UseFilters, UseGuards } from '@nestjs/common';
import { Action, Command, Ctx, Update } from '@xtcry/nestjs-telegraf';

import { TelegramError } from 'telegraf';
import { ExtraEditMessageText } from 'telegraf/typings/telegram-types';

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
import { BroadcastCampaignStatus } from '../../../broadcast/broadcast.types';
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

    const hasCurrent = await this.hasCurrentCampaign();

    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_Menu),
      this.keyboardFactory.getBroadcastMenu(ctx, hasCurrent),
    );
  }

  @Command('broadcast_status')
  async onBroadcastStatus(@Ctx() ctx: IMessageContext) {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getActiveCampaign(SocialType.Telegram),
      this.broadcastService.getQueueStatus(SocialType.Telegram),
    ]);
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      {
        ...(campaign?.sourceMessage.messageId
          ? {
              reply_parameters: {
                message_id: campaign.sourceMessage.messageId,
              },
            }
          : {}),
        ...(status.hasPending
          ? this.keyboardFactory.getBroadcastQueueControls(ctx, status.paused)
          : {}),
      },
    );
  }

  @Command('broadcast_list')
  async onBroadcastList(@Ctx() ctx: IMessageContext) {
    const items = await this.broadcastService.getRecentCampaigns(
      SocialType.Telegram,
    );
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignsList, { items }),
      this.keyboardFactory.getBroadcastCampaignsList(ctx, items),
    );
  }

  @Command('broadcast_delete')
  async onBroadcastDelete(@Ctx() ctx: IMessageContext) {
    const campaignId = Number(ctx.payload || ctx.args?.[0]);
    if (!campaignId) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleteUsage),
      );
      return;
    }

    const result = await this.broadcastService.deleteCampaignMessages(
      campaignId,
      SocialType.Telegram,
    );
    if (!result) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignNotFound, {
          campaignId,
        }),
      );
      return;
    }

    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleted, result),
    );
  }

  @Action('broadcast:menu:panel')
  async onBroadcastPanel(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.tryAnswerCbQuery();
    const hasCurrent = await this.hasCurrentCampaign();
    await this.safeEditMessageText(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_Menu),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastMenu(ctx, hasCurrent),
      },
    );
  }

  @Action('broadcast:menu:create')
  async onBroadcastCreate(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.tryAnswerCbQuery();
    if (await this.editActiveCampaign(ctx)) return;

    await ctx.scene.enter(TELEGRAM_BROADCAST_SCENE);
  }

  @Action('broadcast:menu:status')
  async onBroadcastStatusAction(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.tryAnswerCbQuery();
    await this.editQueueStatus(ctx);
  }

  @Action('broadcast:menu:current')
  async onBroadcastCurrent(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.tryAnswerCbQuery();
    const campaign = await this.broadcastService.getActiveCampaign(
      SocialType.Telegram,
    );
    if (!campaign) {
      await this.editQueueStatus(ctx);
      return;
    }

    await this.editCampaignDetails(ctx, campaign.id);
  }

  @Action('broadcast:menu:list')
  async onBroadcastListAction(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.tryAnswerCbQuery();
    await this.editCampaignsList(ctx);
  }

  @Action(/broadcast:campaign:detail:(?<campaignId>\d+)/)
  async onBroadcastCampaignDetails(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.tryAnswerCbQuery();
    await this.editCampaignDetails(ctx, Number(ctx.match!.groups!.campaignId));
  }

  @Action(/broadcast:campaign:delete:(?<campaignId>\d+)/)
  async onBroadcastCampaignDelete(@Ctx() ctx: ICallbackQueryContext) {
    const campaignId = Number(ctx.match!.groups!.campaignId);
    const result = await this.broadcastService.deleteCampaignMessages(
      campaignId,
      SocialType.Telegram,
    );
    await ctx.tryAnswerCbQuery(
      ctx.i18n.t(
        result
          ? LocalePhrase.Broadcast_Notification_Deleted
          : LocalePhrase.Broadcast_Notification_NotFound,
      ),
    );

    if (!result) {
      await this.safeEditMessageText(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignNotFound, {
          campaignId,
        }),
        {
          parse_mode: 'HTML',
          ...this.keyboardFactory.getBroadcastMenu(ctx),
        },
      );
      return;
    }

    await this.safeEditMessageText(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleted, result),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastMenu(ctx),
      },
    );
  }

  @Command('broadcast_terminate')
  async onBroadcastTerminate(@Ctx() ctx: IMessageContext) {
    await this.broadcastService.terminateActiveCampaigns(SocialType.Telegram);
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Broadcast_Notification_Terminated),
    );
  }

  @Action(/broadcast:queue:(?<action>pause|resume|terminate)/)
  async onQueueAction(@Ctx() ctx: ICallbackQueryContext) {
    const action = ctx.match!.groups!.action;

    if (action === 'pause') {
      await this.broadcastService.pauseQueue(SocialType.Telegram);
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Broadcast_Notification_Paused),
      );
    }
    if (action === 'resume') {
      await this.broadcastService.resumeQueue(SocialType.Telegram);
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Broadcast_Notification_Resumed),
      );
    }
    if (action === 'terminate') {
      await this.broadcastService.terminateActiveCampaigns(SocialType.Telegram);
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Broadcast_Notification_Terminated),
      );
    }

    const status = await this.broadcastService.getQueueStatus(
      SocialType.Telegram,
    );
    await this.safeEditMessageText(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      {
        parse_mode: 'HTML',
        ...(!status.hasPending || action === 'terminate'
          ? {}
          : this.keyboardFactory.getBroadcastQueueControls(ctx, status.paused)),
      },
    );
  }

  private async editCampaignsList(ctx: ICallbackQueryContext) {
    const items = await this.broadcastService.getRecentCampaigns(
      SocialType.Telegram,
    );
    await this.safeEditMessageText(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignsList, { items }),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastCampaignsList(ctx, items),
      },
    );
  }

  private async editCampaignDetails(
    ctx: ICallbackQueryContext,
    campaignId: number,
  ) {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getCampaignForSocial(
        campaignId,
        SocialType.Telegram,
      ),
      this.broadcastService.getQueueStatus(SocialType.Telegram),
    ]);

    if (!campaign) {
      const hasCurrent = await this.hasCurrentCampaign();
      await this.safeEditMessageText(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignNotFound, {
          campaignId,
        }),
        {
          parse_mode: 'HTML',
          ...this.keyboardFactory.getBroadcastMenu(ctx, hasCurrent),
        },
      );
      return;
    }

    const active = [
      BroadcastCampaignStatus.Queued,
      BroadcastCampaignStatus.Running,
    ].includes(campaign.status);
    await this.safeEditMessageText(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDetails, { campaign }),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastCampaignDetails(ctx, {
          campaignId: campaign.id,
          active,
          paused: status.paused,
        }),
      },
    );
  }

  private async editQueueStatus(ctx: ICallbackQueryContext) {
    const status = await this.broadcastService.getQueueStatus(
      SocialType.Telegram,
    );
    await this.safeEditMessageText(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      {
        parse_mode: 'HTML',
        ...(status.hasPending
          ? this.keyboardFactory.getBroadcastQueueControls(ctx, status.paused)
          : this.keyboardFactory.getBroadcastMenu(ctx)),
      },
    );
  }

  private async editActiveCampaign(ctx: ICallbackQueryContext) {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getActiveCampaign(SocialType.Telegram),
      this.broadcastService.getQueueStatus(SocialType.Telegram),
    ]);
    if (!campaign && !status.hasPending) return false;

    await this.safeEditMessageText(
      ctx,
      [
        ctx.i18n.t(LocalePhrase.Page_Broadcast_AlreadyActive, { campaign }),
        '',
        ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      ].join('\n'),
      {
        parse_mode: 'HTML',
        ...(status.hasPending
          ? this.keyboardFactory.getBroadcastQueueControls(ctx, status.paused)
          : this.keyboardFactory.getBroadcastMenu(ctx)),
      },
    );
    return true;
  }

  private async hasCurrentCampaign() {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getActiveCampaign(SocialType.Telegram),
      this.broadcastService.getQueueStatus(SocialType.Telegram),
    ]);

    return !!campaign || status.hasPending;
  }

  private async safeEditMessageText(
    ctx: ICallbackQueryContext,
    text: string,
    extra: ExtraEditMessageText,
  ) {
    try {
      await ctx.editMessageText(text, extra);
    } catch (err) {
      if (
        err instanceof TelegramError &&
        err.description.includes('message is not modified')
      ) {
        return;
      }

      throw err;
    }
  }
}
