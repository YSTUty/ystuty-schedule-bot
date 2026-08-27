import { UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, OnMessageEvent, Update } from 'nestjs-vk';

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { VkHearsLocale } from '@my-common/decorator/vk';
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

    const campaign = await this.broadcastService.getCampaignForSocial(
      campaignId,
      SocialType.Vkontakte,
    );
    if (!campaign) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignNotFound, {
          campaignId,
        }),
      );
      return;
    }

    await ctx.send(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleteConfirm, {
        campaignId,
      }),
      {
        keyboard: this.keyboardFactory
          .getBroadcastCampaignDeleteConfirmation(ctx, campaignId)
          .inline(),
      },
    );
  }

  @Hears('/broadcast_terminate')
  async onBroadcastTerminate(@Ctx() ctx: IMessageContext) {
    await this.broadcastService.terminateActiveCampaigns(SocialType.Vkontakte);
    await ctx.send(ctx.i18n.t(LocalePhrase.Broadcast_Notification_Terminated));
  }

  @OnMessageEvent((payload) =>
    [
      'menuPanel',
      'menuCreate',
      'menuStatus',
      'menuCurrent',
      'menuList',
      'detail',
      'applySettings',
      'delete',
      'deleteAll',
      'deleteSelect',
      'deleteToggle',
      'deleteSelected',
      'pause',
      'resume',
      'terminate',
    ].includes(payload.broadcastAction as string),
  )
  async onQueueAction(@Ctx() ctx: IMessageEventContext) {
    const action = ctx.eventPayload?.broadcastAction as string | undefined;

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

    if (action === 'applySettings') {
      const campaignId = Number(ctx.eventPayload.campaignId);
      const campaign = await this.broadcastService.getCampaignForSocial(
        campaignId,
        SocialType.Vkontakte,
      );
      if (!campaign) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_NotFound),
        });
        await this.editCampaignDetails(ctx, campaignId);
        return;
      }

      const reuse = this.broadcastService.getCampaignSettingsForReuse(campaign);
      if (!reuse.compatible) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(
            LocalePhrase.Broadcast_Notification_SettingsIncompatible,
          ),
        });
        return;
      }

      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_SettingsApplied),
      });
      await ctx.scene.enter(VK_BROADCAST_SCENE, {
        state: { reusedSettings: reuse.settings },
      });
      return;
    }

    if (action === 'delete') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Campaign),
      });
      await this.renderDeleteConfirmation(
        ctx,
        Number(ctx.eventPayload.campaignId),
      );
      return;
    }

    if (action === 'deleteAll') {
      await this.deleteCampaign(ctx, Number(ctx.eventPayload.campaignId));
      return;
    }

    if (action === 'deleteSelect') {
      await ctx.answer({ type: 'show_snackbar', text: 'Готово' });
      await this.renderDeleteSelector(
        ctx,
        Number(ctx.eventPayload.campaignId),
        Number(ctx.eventPayload.page) || 1,
      );
      return;
    }

    if (action === 'deleteToggle') {
      const campaignId = String(ctx.eventPayload.campaignId);
      const selected = new Set(
        ctx.session.broadcastDeleteSelections?.[campaignId] || [],
      );
      const deliveryId = Number(ctx.eventPayload.deliveryId);
      if (selected.has(deliveryId)) {
        selected.delete(deliveryId);
      } else {
        selected.add(deliveryId);
      }
      ctx.session.broadcastDeleteSelections = {
        ...ctx.session.broadcastDeleteSelections,
        [campaignId]: [...selected],
      };
      await ctx.answer({ type: 'show_snackbar', text: 'Готово' });
      await this.renderDeleteSelector(
        ctx,
        Number(campaignId),
        Number(ctx.eventPayload.page) || 1,
      );
      return;
    }

    if (action === 'deleteSelected') {
      await this.deleteSelectedCampaignMessages(
        ctx,
        Number(ctx.eventPayload.campaignId),
        Number(ctx.eventPayload.page) || 1,
      );
      return;
    }

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
    const result = await this.broadcastService.deleteCampaignMessages(
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

  private async renderDeleteConfirmation(
    ctx: IMessageEventContext,
    campaignId: number,
  ) {
    const campaign = await this.broadcastService.getCampaignForSocial(
      campaignId,
      SocialType.Vkontakte,
    );
    if (!campaign) {
      await this.editCampaignDetails(ctx, campaignId);
      return;
    }

    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleteConfirm, {
        campaignId,
      }),
      keyboard: this.keyboardFactory
        .getBroadcastCampaignDeleteConfirmation(ctx, campaignId)
        .inline(),
    });
  }

  private async renderDeleteSelector(
    ctx: IMessageEventContext,
    campaignId: number,
    page: number,
  ) {
    const result = await this.broadcastService.getCampaignMessageDeliveriesPage(
      {
        campaignId,
        social: SocialType.Vkontakte,
        page,
        limit: 3,
      },
    );
    if (!result) {
      await this.editCampaignDetails(ctx, campaignId);
      return;
    }
    if (!result.total) {
      await ctx.api.messages.edit({
        peer_id: ctx.peerId,
        cmid: ctx.conversationMessageId,
        message: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleteEmpty),
        keyboard: this.keyboardFactory
          .getBroadcastCampaignDeleteConfirmation(ctx, campaignId)
          .inline(),
      });
      return;
    }

    const selected = new Set(
      ctx.session.broadcastDeleteSelections?.[String(campaignId)] || [],
    );
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleteSelector, {
        campaignId,
        selectedCount: selected.size,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      }),
      keyboard: this.keyboardFactory
        .getBroadcastCampaignDeleteSelector({
          ctx,
          campaignId,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          selectedCount: selected.size,
          items: result.items.map((delivery) => ({
            id: delivery.id,
            selected: selected.has(delivery.id),
            title: this.renderDeliveryTitle(delivery),
          })),
        })
        .inline(),
    });
  }

  private async deleteSelectedCampaignMessages(
    ctx: IMessageEventContext,
    campaignId: number,
    page: number,
  ) {
    const selectedIds =
      ctx.session.broadcastDeleteSelections?.[String(campaignId)] || [];
    if (!selectedIds.length) {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleteNoSelection),
      });
      return;
    }

    const result = await this.broadcastService.deleteCampaignMessages(
      campaignId,
      { social: SocialType.Vkontakte, deliveryIds: selectedIds },
    );
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(
        result
          ? LocalePhrase.Broadcast_Notification_Deleted
          : LocalePhrase.Broadcast_Notification_NotFound,
      ),
    });
    if (!result) {
      await this.renderDeleteConfirmation(ctx, campaignId);
      return;
    }

    delete ctx.session.broadcastDeleteSelections?.[String(campaignId)];
    if (result.remainingCount) {
      await this.renderDeleteSelector(ctx, campaignId, page);
      return;
    }

    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_CampaignDeleted, result),
      keyboard: this.keyboardFactory
        .getBroadcastMenu(ctx, await this.hasCurrentCampaign())
        .inline(),
    });
  }

  private renderDeliveryTitle(delivery: {
    targetSocialId: string;
    userSocial?: {
      socialId: number;
      username?: string | null;
      displayname?: string | null;
      groupName?: string | null;
    } | null;
  }) {
    const userSocial = delivery.userSocial;
    return [
      userSocial?.displayname ||
        userSocial?.username ||
        `id${delivery.targetSocialId}`,
      userSocial?.groupName ? `(${userSocial.groupName})` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 50);
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
