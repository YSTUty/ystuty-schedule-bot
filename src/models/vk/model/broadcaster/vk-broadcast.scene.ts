import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { AttachmentType } from 'vk-io';
import type { MessagesEditParams } from 'vk-io/lib/api/schemas/params';

import { SocialType, VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { VK_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import {
  BroadcastAudienceFilter,
  BroadcastMessageMode,
  BroadcastSourceMessage,
} from '../../../broadcast/broadcast.types';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

type VkBroadcastState = {
  filter: BroadcastAudienceFilter;
  sourceMessage?: BroadcastSourceMessage;
  recipientsCount?: number;
  selectedRecipientIds: number[];
  recipientsPage: number;
  manualRecipients: boolean;
  confirmMessage?: { chatId: number; messageId: number };
};

type IStepCtx = IStepContext<VkBroadcastState>;

@Scene(VK_BROADCAST_SCENE)
@UseFilters(VkExceptionFilter)
export class VkBroadcastScene {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @AddStep()
  async step1(@Ctx() ctx: IStepCtx) {
    if (ctx.scene.step.firstTime) {
      ctx.scene.state.filter = {
        hasDM: true,
        isBlockedBot: false,
      };
      ctx.scene.state.selectedRecipientIds = [];
      ctx.scene.state.recipientsPage = 1;
      ctx.scene.state.manualRecipients = false;
      ctx.scene.state.recipientsCount =
        await this.broadcastService.countRecipients(
          SocialType.Vkontakte,
          ctx.scene.state.filter,
        );

      await ctx.send(this.renderSettings(ctx), {
        keyboard: this.keyboardFactory.getBroadcastSettings(ctx).inline(),
      });
    }

    if ('eventPayload' in ctx) {
      const handled = await this.handleSettingsAction(ctx);
      if (handled) return;
    }

    return ctx.scene.step.next({ silent: true });
  }

  @AddStep()
  async step2(@Ctx() ctx: IStepCtx) {
    if (ctx.text === '/cancel') {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_Canceled));
      return ctx.scene.leave();
    }

    if ('eventPayload' in ctx) {
      const handled = await this.handleSettingsAction(ctx);
      if (handled) return;
    }

    const sourceMessage = this.getSourceMessage(ctx);
    if (!sourceMessage) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_MessageNotFound));
      return;
    }

    if (
      ctx.scene.state.manualRecipients &&
      ctx.scene.state.selectedRecipientIds.length === 0
    ) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_NoRecipients));
      return;
    }

    ctx.scene.state.sourceMessage = sourceMessage;
    await this.refreshRecipientsCount(ctx.scene.state);
    const reportMessage = await ctx.send(this.renderReady(ctx), {
      keyboard: this.keyboardFactory.getBroadcastConfirm(ctx).inline(),
      reply_to: ctx.id,
    });
    const reportMessageId =
      reportMessage.conversationMessageId ?? reportMessage.id;
    if (reportMessageId) {
      ctx.scene.state.confirmMessage = {
        chatId: reportMessage.peerId,
        messageId: reportMessageId,
      };
    }

    return ctx.scene.step.next({ silent: true });
  }

  @AddStep()
  async step3(@Ctx() ctx: IStepCtx) {
    if (ctx.text === '/cancel') {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_Canceled));
      return ctx.scene.leave();
    }

    if (
      'eventPayload' in ctx &&
      ctx.eventPayload?.broadcastAction === 'backToSettings'
    ) {
      await this.backToSettings(ctx);
      return;
    }

    const isCreateAction =
      'eventPayload' in ctx && ctx.eventPayload?.broadcastAction === 'create';
    if (ctx.text !== '/send' && !isCreateAction) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_SendCommandHint));
      return;
    }

    if (isCreateAction && 'answer' in ctx) {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_QueueCreated),
      });
    }

    if (
      ctx.scene.state.manualRecipients &&
      ctx.scene.state.selectedRecipientIds.length === 0
    ) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_NoRecipients));
      return;
    }

    const campaign = await this.createCampaignOrReplyActive(ctx);
    if (!campaign) return;

    if (ctx.scene.state.confirmMessage) {
      await ctx.api.messages.edit({
        peer_id: ctx.scene.state.confirmMessage.chatId,
        cmid: ctx.scene.state.confirmMessage.messageId,
        message: this.renderReady(ctx),
        keep_forward_messages: true,
        keyboard: this.keyboardFactory.getClose(ctx).inline(),
      });
    }

    const queuedMessage = await ctx.send(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_Queued, {
        campaignId: campaign.id,
        recipientsCount: campaign.totalCount,
      }),
      {
        reply_to: ctx.scene.state.sourceMessage?.messageId,
        keyboard: this.keyboardFactory
          .getBroadcastQueueControls(ctx, true)
          .inline(),
      },
    );
    const queuedMessageId =
      queuedMessage.conversationMessageId ?? queuedMessage.id;
    if (queuedMessageId) {
      await this.broadcastService.updateCampaignSourceMessage(campaign.id, {
        ...campaign.sourceMessage,
        reportMessage: {
          chatId: queuedMessage.peerId,
          messageId: queuedMessageId,
        },
      });
    }
    return ctx.scene.leave();
  }

  private getSourceMessage(ctx: IStepCtx): BroadcastSourceMessage | null {
    if (ctx.hasText) {
      return { text: ctx.text, messageId: ctx.id };
    }

    if (ctx.hasAttachments(AttachmentType.STICKER)) {
      const stickers = ctx.getAttachments(AttachmentType.STICKER);
      return stickers[0]?.id
        ? { stickerId: stickers[0].id, messageId: ctx.id }
        : null;
    }

    // TODO(broadcast): продумать корректную пересылку VK-вложений.
    // У разных типов вложений разная структура и не все можно безопасно
    // восстановить через строковое представление без потери контекста.
    // if (ctx.hasAttachments(AttachmentType.WALL)) {
    //   const walls = ctx.getAttachments(AttachmentType.WALL);
    //   console.log(walls);
    //   return { wallId: walls[0].id };
    // }

    // const attachments = 'attachments' in ctx ? ctx.attachments : [];
    // const attachment = attachments.map((e) => e.toJSON());
    // console.log(attachments);
    // if (attachment) {
    //   return { text: '', attachment };
    // }

    return null;
  }

  private async handleSettingsAction(ctx: IStepCtx) {
    if (!('eventPayload' in ctx)) return false;

    const action = ctx.eventPayload?.broadcastAction as
      | 'audienceAll'
      | 'audienceManual'
      | 'recipients'
      | 'toggleRecipient'
      | 'backToSettings'
      | undefined;
    if (!action) return false;

    if (action === 'audienceAll') {
      ctx.scene.state.manualRecipients = false;
      await this.refreshRecipientsCount(ctx.scene.state);
      await this.editCurrentVkMessage(ctx, this.renderSettings(ctx), {
        keep_forward_messages: true,
        keyboard: this.keyboardFactory
          .getBroadcastSettings(ctx, false)
          .inline(),
      });
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_AudienceAll),
      });
      return true;
    }

    if (action === 'audienceManual') {
      ctx.scene.state.manualRecipients = true;
      await this.refreshRecipientsCount(ctx.scene.state);
      await this.renderRecipientsSelector(ctx, 1);
      return true;
    }

    if (action === 'recipients') {
      await this.renderRecipientsSelector(
        ctx,
        Number(ctx.eventPayload.page) || 1,
      );
      return true;
    }

    if (action === 'toggleRecipient') {
      const id = Number(ctx.eventPayload.id);
      const selected = new Set(ctx.scene.state.selectedRecipientIds);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      ctx.scene.state.selectedRecipientIds = [...selected];
      ctx.scene.state.manualRecipients = true;
      await this.renderRecipientsSelector(ctx, ctx.scene.state.recipientsPage);
      return true;
    }

    if (action === 'backToSettings') {
      await this.refreshRecipientsCount(ctx.scene.state);
      await this.editCurrentVkMessage(ctx, this.renderSettings(ctx), {
        keep_forward_messages: true,
        keyboard: this.keyboardFactory
          .getBroadcastSettings(ctx, ctx.scene.state.manualRecipients)
          .inline(),
      });
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    return false;
  }

  private async renderRecipientsSelector(ctx: IStepCtx, page: number) {
    ctx.scene.state.recipientsPage = page;
    ctx.scene.state.manualRecipients = true;
    const recipients = await this.broadcastService.getRecipientsPage({
      social: SocialType.Vkontakte,
      filter: ctx.scene.state.filter,
      page,
      // В списке есть отдельная строка возврата и pager, поэтому доступны четыре получателя.
      limit: 4,
    });
    const selected = new Set(ctx.scene.state.selectedRecipientIds);

    await this.editCurrentVkMessage(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_SelectRecipients, {
        selectedCount: ctx.scene.state.selectedRecipientIds.length,
        currentPage: recipients.currentPage,
        totalPages: recipients.totalPages,
      }),
      {
        keep_forward_messages: true,
        keyboard: this.keyboardFactory
          .getBroadcastRecipients({
            ctx,
            items: recipients.items.map((recipient) => ({
              id: recipient.id,
              title: this.renderRecipientTitle(recipient),
              selected: selected.has(recipient.id),
            })),
            currentPage: recipients.currentPage,
            totalPages: recipients.totalPages,
          })
          .inline(),
      },
    );
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Recipients),
    });
  }

  private async editCurrentVkMessage(
    ctx: IStepCtx,
    message: string,
    params: OmitT<MessagesEditParams, 'peer_id' | 'cmid' | 'message'>,
  ) {
    if (!('conversationMessageId' in ctx)) return;

    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message,
      ...params,
    });
  }

  private async createCampaignOrReplyActive(ctx: IStepCtx) {
    try {
      return await this.broadcastService.createAndQueueCampaign({
        social: SocialType.Vkontakte,
        mode: BroadcastMessageMode.Text,
        sourceMessage: {
          ...ctx.scene.state.sourceMessage!,
        },
        audienceFilter: ctx.scene.state.filter,
        recipientUserSocialIds: ctx.scene.state.manualRecipients
          ? ctx.scene.state.selectedRecipientIds
          : undefined,
        createdBySocialId: ctx.senderId,
      });
    } catch (err) {
      const [campaign, status] = await Promise.all([
        this.broadcastService.getActiveCampaign(SocialType.Vkontakte),
        this.broadcastService.getQueueStatus(SocialType.Vkontakte),
      ]);
      if (!campaign && !status.hasPending) throw err;

      await ctx.send(
        [
          ctx.i18n.t(LocalePhrase.Page_Broadcast_AlreadyActive, { campaign }),
          '',
          ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
        ].join('\n'),
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
      return null;
    }
  }

  private async backToSettings(ctx: IStepCtx) {
    ctx.scene.state.sourceMessage = undefined;
    ctx.scene.state.confirmMessage = undefined;
    await this.refreshRecipientsCount(ctx.scene.state);

    if ('answer' in ctx) {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
    }

    await this.editCurrentVkMessage(ctx, this.renderSettings(ctx), {
      keyboard: this.keyboardFactory
        .getBroadcastSettings(ctx, ctx.scene.state.manualRecipients)
        .inline(),
    });
    return ctx.scene.step.previous({ silent: true });
  }

  private renderSettings(ctx: IStepCtx) {
    return ctx.i18n.t(LocalePhrase.Page_Broadcast_Settings, {
      recipientsCount: ctx.scene.state.recipientsCount ?? 0,
      selectedCount: ctx.scene.state.selectedRecipientIds.length,
      audienceMode: ctx.scene.state.manualRecipients ? 'manual' : 'all',
    });
  }

  private renderReady(ctx: IStepCtx) {
    return ctx.i18n.t(LocalePhrase.Page_Broadcast_Ready, {
      recipientsCount: ctx.scene.state.recipientsCount ?? 0,
      selectedCount: ctx.scene.state.selectedRecipientIds.length,
    });
  }

  private async refreshRecipientsCount(state: VkBroadcastState) {
    const count = await this.broadcastService.countRecipients(
      SocialType.Vkontakte,
      state.filter,
    );
    state.recipientsCount = state.manualRecipients
      ? state.selectedRecipientIds.length
      : count;
  }

  private renderRecipientTitle(recipient: {
    socialId: number;
    username?: string | null;
    displayname?: string | null;
    groupName?: string | null;
  }) {
    return [
      recipient.displayname || recipient.username || `id${recipient.socialId}`,
      recipient.groupName ? `(${recipient.groupName})` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 40);
  }
}
