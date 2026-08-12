import { UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Next, Update } from 'nestjs-vk';

import { NextMiddleware } from 'middleware-io';

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { OnMessageEvent, VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { VK_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import { BroadcastCampaignStatus } from '../../../broadcast/broadcast.types';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

@Update()
@UseFilters(VkExceptionFilter)
@UseGuards(VkAdminGuard(true))
export class BroadcastVkUpdate {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @Hears('/broadcast')
  @VkHearsLocale(LocalePhrase.Button_Broadcast)
  async onBroadcast(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_PrivateOnly));
      return;
    }

    const hasCurrent = await this.hasCurrentCampaign();

    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_Menu), {
      keyboard: this.keyboardFactory.getBroadcastMenu(ctx, hasCurrent).inline(),
    });
  }

  @Hears('/broadcast_status')
  async onBroadcastStatus(@Ctx() ctx: IMessageContext) {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getActiveCampaign(SocialType.Vkontakte),
      this.broadcastService.getQueueStatus(SocialType.Vkontakte),
    ]);
    await ctx.send(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      {
        ...(campaign?.sourceMessage.messageId
          ? { reply_to: campaign.sourceMessage.messageId }
          : {}),
        ...(status.hasPending && {
          keyboard: this.keyboardFactory
            .getBroadcastQueueControls(ctx, status.paused)
            .inline(),
        }),
      },
    );
  }

  @Hears('/broadcast_list')
  async onBroadcastList(@Ctx() ctx: IMessageContext) {
    const items = await this.broadcastService.getRecentCampaigns(
      SocialType.Vkontakte,
    );
    await ctx.send(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignsList, { items }),
      {
        keyboard: this.keyboardFactory
          .getBroadcastCampaignsList(ctx, items)
          .inline(),
      },
    );
  }

  @Hears(/^\/broadcast_delete(\s+(?<campaignId>\d+))?$/i)
  async onBroadcastDelete(@Ctx() ctx: IMessageContext) {
    const campaignId = Number(ctx.$match?.groups?.campaignId);
    if (!campaignId) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleteUsage),
      );
      return;
    }

    const result = await this.broadcastService.deleteCampaignDeliveries(
      campaignId,
      SocialType.Vkontakte,
    );
    if (!result) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignNotFound, {
          campaignId,
        }),
      );
      return;
    }

    await ctx.send(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleted, result),
    );
  }

  @Hears('/broadcast_terminate')
  async onBroadcastTerminate(@Ctx() ctx: IMessageContext) {
    await this.broadcastService.terminateActiveCampaigns(SocialType.Vkontakte);
    await ctx.send(ctx.i18n.t(LocalePhrase.Broadcast_Notification_Terminated));
  }

  @OnMessageEvent()
  async onQueueAction(
    @Ctx() ctx: IMessageEventContext,
    @Next() next: NextMiddleware,
  ) {
    const action = ctx.eventPayload?.broadcastAction as string | undefined;

    if (!action) {
      return next();
    }

    if (action === 'menuPanel') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Menu),
      });
      await this.editPanel(ctx);
      return;
    }

    if (action === 'menuCreate') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Create),
      });
      if (await this.editActiveCampaign(ctx)) return;

      await ctx.scene.enter(VK_BROADCAST_SCENE);
      return;
    }

    if (action === 'menuStatus') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Status),
      });
      await this.editQueueStatus(ctx);
      return;
    }

    if (action === 'menuCurrent') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Current),
      });
      const campaign = await this.broadcastService.getActiveCampaign(
        SocialType.Vkontakte,
      );
      if (!campaign) {
        await this.editQueueStatus(ctx);
        return;
      }

      await this.editCampaignDetails(ctx, campaign.id);
      return;
    }

    if (action === 'menuList') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_List),
      });
      await this.editCampaignsList(ctx);
      return;
    }

    if (action === 'detail') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Campaign),
      });
      await this.editCampaignDetails(ctx, Number(ctx.eventPayload.campaignId));
      return;
    }

    if (action === 'delete') {
      await this.deleteCampaign(ctx, Number(ctx.eventPayload.campaignId));
      return;
    }

    if (!['pause', 'resume', 'terminate'].includes(action)) return next();

    if (action === 'pause') {
      await this.broadcastService.pauseQueue(SocialType.Vkontakte);
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Paused),
      });
    }
    if (action === 'resume') {
      await this.broadcastService.resumeQueue(SocialType.Vkontakte);
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Resumed),
      });
    }
    if (action === 'terminate') {
      await this.broadcastService.terminateActiveCampaigns(
        SocialType.Vkontakte,
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Terminated),
      });
    }

    const status = await this.broadcastService.getQueueStatus(
      SocialType.Vkontakte,
    );
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      ...(status.hasPending && action !== 'terminate'
        ? {
            keyboard: this.keyboardFactory
              .getBroadcastQueueControls(ctx, status.paused)
              .inline(),
          }
        : { keyboard: this.keyboardFactory.getClose(ctx).inline() }),
    });
  }

  private async editPanel(ctx: IMessageEventContext) {
    const hasCurrent = await this.hasCurrentCampaign();
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_Menu),
      keyboard: this.keyboardFactory.getBroadcastMenu(ctx, hasCurrent).inline(),
    });
  }

  private async editCampaignsList(ctx: IMessageEventContext) {
    const items = await this.broadcastService.getRecentCampaigns(
      SocialType.Vkontakte,
    );
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignsList, {
        items,
      }),
      keyboard: this.keyboardFactory
        .getBroadcastCampaignsList(ctx, items)
        .inline(),
    });
  }

  private async editCampaignDetails(
    ctx: IMessageEventContext,
    campaignId: number,
  ) {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getCampaignForSocial(
        campaignId,
        SocialType.Vkontakte,
      ),
      this.broadcastService.getQueueStatus(SocialType.Vkontakte),
    ]);

    if (!campaign) {
      const hasCurrent = await this.hasCurrentCampaign();
      await ctx.api.messages.edit({
        peer_id: ctx.peerId,
        cmid: ctx.conversationMessageId,
        message: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignNotFound, {
          campaignId,
        }),
        keyboard: this.keyboardFactory
          .getBroadcastMenu(ctx, hasCurrent)
          .inline(),
      });
      return;
    }

    const active = [
      BroadcastCampaignStatus.Queued,
      BroadcastCampaignStatus.Running,
    ].includes(campaign.status);
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDetails, {
        campaign,
      }),
      keyboard: this.keyboardFactory
        .getBroadcastCampaignDetails(ctx, {
          campaignId: campaign.id,
          active,
          paused: status.paused,
        })
        .inline(),
    });
  }

  private async deleteCampaign(ctx: IMessageEventContext, campaignId: number) {
    const result = await this.broadcastService.deleteCampaignDeliveries(
      campaignId,
      SocialType.Vkontakte,
    );
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(
        result
          ? LocalePhrase.Broadcast_Notification_Deleted
          : LocalePhrase.Broadcast_Notification_NotFound,
      ),
    });

    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: result
        ? ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleted, result)
        : ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignNotFound, {
            campaignId,
          }),
      keyboard: this.keyboardFactory
        .getBroadcastMenu(ctx, await this.hasCurrentCampaign())
        .inline(),
    });
  }

  private async editQueueStatus(ctx: IMessageEventContext) {
    const status = await this.broadcastService.getQueueStatus(
      SocialType.Vkontakte,
    );
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      keyboard: status.hasPending
        ? this.keyboardFactory
            .getBroadcastQueueControls(ctx, status.paused)
            .inline()
        : this.keyboardFactory
            .getBroadcastMenu(ctx, await this.hasCurrentCampaign())
            .inline(),
    });
  }

  private async editActiveCampaign(ctx: IMessageEventContext) {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getActiveCampaign(SocialType.Vkontakte),
      this.broadcastService.getQueueStatus(SocialType.Vkontakte),
    ]);
    if (!campaign && !status.hasPending) return false;

    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: [
        ctx.i18n.t(LocalePhrase.Page_Broadcast_AlreadyActive, { campaign }),
        '',
        ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      ].join('\n'),
      keyboard: status.hasPending
        ? this.keyboardFactory
            .getBroadcastQueueControls(ctx, status.paused)
            .inline()
        : this.keyboardFactory
            .getBroadcastMenu(ctx, await this.hasCurrentCampaign())
            .inline(),
    });
    return true;
  }

  private async hasCurrentCampaign() {
    const [campaign, status] = await Promise.all([
      this.broadcastService.getActiveCampaign(SocialType.Vkontakte),
      this.broadcastService.getQueueStatus(SocialType.Vkontakte),
    ]);

    return !!campaign || status.hasPending;
  }
}
