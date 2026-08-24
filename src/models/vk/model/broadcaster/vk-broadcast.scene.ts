import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { AttachmentType, Keyboard } from 'vk-io';
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
import { BroadcastAudienceGroupFilterService } from '../../../broadcast/filter/broadcast-audience-group-filter.service';
import { ScheduleService } from '../../../schedule/schedule.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

type VkBroadcastState = {
  filter: BroadcastAudienceFilter;
  sourceMessage?: BroadcastSourceMessage;
  recipientsCount?: number;
  selectedRecipientIds: number[];
  recipientsPage: number;
  manualRecipients: boolean;
  awaitingFilter?: 'groups' | 'activity' | 'excludeCampaigns';
  activeGroupFilter?: { institutesPage: number; instituteIndex: number };
  confirmMessage?: { chatId: number; messageId: number };
};

type IStepCtx = IStepContext<VkBroadcastState>;

@Scene(VK_BROADCAST_SCENE)
@UseFilters(VkExceptionFilter)
export class VkBroadcastScene {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly groupFilterService: BroadcastAudienceGroupFilterService,
    private readonly scheduleService: ScheduleService,
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
      ctx.scene.state.awaitingFilter = undefined;
      ctx.scene.state.recipientsCount =
        await this.broadcastService.countRecipients(
          SocialType.Vkontakte,
          ctx.scene.state.filter,
        );

      await ctx.send(this.renderSettings(ctx), {
        keyboard: this.getSettingsKeyboard(ctx).inline(),
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

    if (ctx.scene.state.awaitingFilter && ctx.text) {
      await this.applyTextFilter(ctx, ctx.scene.state.awaitingFilter, ctx.text);
      return;
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
      | 'filterAuthorized'
      | 'filters'
      | 'filterGroups'
      | 'filterGroupsText'
      | 'filterGroupsTextShow'
      | 'filterGroupsTextCancel'
      | 'filterActivity'
      | 'filterExcludeCampaigns'
      | 'filterTextCancel'
      | 'filterGroupsClear'
      | 'filterGroupsShow'
      | 'filterInstitutes'
      | 'filterInstitute'
      | 'filterGroupsPage'
      | 'filterGroupToggle'
      | 'filterInstituteToggle'
      | undefined;
    if (!action) return false;

    if (action === 'audienceAll') {
      ctx.scene.state.manualRecipients = false;
      await this.refreshRecipientsCount(ctx.scene.state);
      await this.editCurrentVkMessage(ctx, this.renderSettings(ctx), {
        keep_forward_messages: true,
        keyboard: this.getSettingsKeyboard(ctx).inline(),
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
        keyboard: this.getSettingsKeyboard(ctx).inline(),
      });
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'filterAuthorized') {
      ctx.scene.state.filter.onlyAuthorized =
        !ctx.scene.state.filter.onlyAuthorized;
      this.resetManualRecipients(ctx.scene.state);
      await this.refreshRecipientsCount(ctx.scene.state);
      await this.renderFilters(ctx);
      return true;
    }

    if (action === 'filters') {
      await this.renderFilters(ctx);
      return true;
    }

    if (action === 'filterGroups') {
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroupsMenu),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastGroupFilterMenu(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'filterGroupsText') {
      ctx.scene.state.awaitingFilter = 'groups';
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroupsText),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastGroupFilterTextPrompt(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'filterGroupsTextShow') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      await this.sendSelectedGroups(ctx);
      return true;
    }

    if (action === 'filterGroupsTextCancel') {
      ctx.scene.state.awaitingFilter = undefined;
      await this.renderFilters(ctx);
      return true;
    }

    if (action === 'filterGroupsClear') {
      ctx.scene.state.filter.groupName = null;
      ctx.scene.state.filter.groupNames = undefined;
      ctx.scene.state.awaitingFilter = undefined;
      this.resetManualRecipients(ctx.scene.state);
      await this.renderFilters(ctx);
      return true;
    }

    if (action === 'filterGroupsShow') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      await this.sendSelectedGroups(ctx);
      return true;
    }

    if (action === 'filterActivity' || action === 'filterExcludeCampaigns') {
      if (
        (action === 'filterActivity' &&
          ctx.scene.state.filter.lastInteractionAfter) ||
        (action === 'filterExcludeCampaigns' &&
          ctx.scene.state.filter.excludeCampaignIds?.length)
      ) {
        if (action === 'filterActivity') {
          ctx.scene.state.filter.lastInteractionAfter = undefined;
        } else {
          ctx.scene.state.filter.excludeCampaignIds = undefined;
        }
        this.resetManualRecipients(ctx.scene.state);
        await this.renderFilters(ctx);
        return true;
      }
      ctx.scene.state.awaitingFilter =
        action === 'filterActivity' ? 'activity' : 'excludeCampaigns';
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(
          action === 'filterActivity'
            ? LocalePhrase.Page_Broadcast_FilterActivityText
            : LocalePhrase.Page_Broadcast_FilterExcludeCampaignsText,
        ),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastFilterTextPrompt(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'filterTextCancel') {
      ctx.scene.state.awaitingFilter = undefined;
      await this.renderFilters(ctx);
      return true;
    }

    if (action === 'filterInstitutes') {
      await this.renderInstitutes(ctx, Number(ctx.eventPayload.page) || 1);
      return true;
    }

    if (action === 'filterInstitute') {
      await this.renderInstituteGroups(
        ctx,
        Number(ctx.eventPayload.page),
        Number(ctx.eventPayload.index),
        1,
      );
      return true;
    }

    if (action === 'filterGroupsPage') {
      const active = ctx.scene.state.activeGroupFilter;
      await this.renderInstituteGroups(
        ctx,
        Number(ctx.eventPayload.page || active?.institutesPage),
        Number(ctx.eventPayload.index || active?.instituteIndex),
        Number(ctx.eventPayload.groupsPage) || 1,
      );
      return true;
    }

    if (action === 'filterGroupToggle') {
      const page = await this.getInstituteGroupsPage(
        ctx,
        Number(ctx.eventPayload.page),
        Number(ctx.eventPayload.index),
        Number(ctx.eventPayload.groupsPage),
      );
      const group = page.items[Number(ctx.eventPayload.groupIndex)];
      if (group) this.toggleGroups(ctx.scene.state, [group.groupName]);
      await this.renderInstituteGroups(
        ctx,
        Number(ctx.eventPayload.page),
        Number(ctx.eventPayload.index),
        Number(ctx.eventPayload.groupsPage),
      );
      return true;
    }

    if (action === 'filterInstituteToggle') {
      const page = await this.getInstituteGroupsPage(
        ctx,
        Number(ctx.eventPayload.page),
        Number(ctx.eventPayload.index),
        Number(ctx.eventPayload.groupsPage),
      );
      if (page.institute) {
        this.toggleGroups(
          ctx.scene.state,
          page.institute.groups.map((group) => group.groupName),
        );
      }
      await this.renderInstituteGroups(
        ctx,
        Number(ctx.eventPayload.page),
        Number(ctx.eventPayload.index),
        Number(ctx.eventPayload.groupsPage),
      );
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
      keyboard: this.getSettingsKeyboard(ctx).inline(),
    });
    return ctx.scene.step.previous({ silent: true });
  }

  private renderSettings(ctx: IStepCtx) {
    return ctx.i18n.t(LocalePhrase.Page_Broadcast_Settings, {
      filter: ctx.scene.state.filter,
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

  /** Ручный список не должен обходить обновлённые фильтры аудитории. */
  private resetManualRecipients(state: VkBroadcastState) {
    state.selectedRecipientIds = [];
    state.manualRecipients = false;
    state.recipientsPage = 1;
  }

  private async applyTextFilter(
    ctx: IStepCtx,
    awaitingFilter: NonNullable<VkBroadcastState['awaitingFilter']>,
    text: string,
  ) {
    if (awaitingFilter === 'groups') {
      const groupNames = this.scheduleService.parseGroupNames(text);
      if (!groupNames.length) {
        await ctx.send(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
            groupName: text,
          }),
        );
        return;
      }
      ctx.scene.state.filter.groupName = null;
      ctx.scene.state.filter.groupNames = groupNames;
    } else if (awaitingFilter === 'activity') {
      const date = this.parseFilterDate(text);
      if (!date) {
        await ctx.send(
          ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterActivityText),
        );
        return;
      }
      ctx.scene.state.filter.lastInteractionAfter = date.toISOString();
    } else {
      const campaignIds = this.parseCampaignIds(text);
      if (!campaignIds.length) {
        await ctx.send(
          ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterExcludeCampaignsText),
        );
        return;
      }
      ctx.scene.state.filter.excludeCampaignIds = campaignIds;
    }

    ctx.scene.state.awaitingFilter = undefined;
    this.resetManualRecipients(ctx.scene.state);
    await this.renderFilters(ctx, false);
  }

  private parseFilterDate(text: string) {
    const normalized = text.trim();
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(normalized);
    const date = match
      ? new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`)
      : new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseCampaignIds(text: string) {
    return [...new Set((text.match(/\d+/g) || []).map(Number))]
      .filter((campaignId) => campaignId > 0)
      .sort((first, second) => first - second);
  }

  private async applyGroupFilter(ctx: IStepCtx, groupNamesText: string) {
    const groupNames = this.scheduleService.parseGroupNames(groupNamesText);
    if (!groupNames.length) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
          groupName: groupNamesText,
        }),
      );
      return;
    }

    ctx.scene.state.filter.groupName = null;
    ctx.scene.state.filter.groupNames = groupNames;
    ctx.scene.state.awaitingFilter = undefined;
    this.resetManualRecipients(ctx.scene.state);
    await this.renderFilters(ctx, false);
  }

  private getSettingsKeyboard(ctx: IStepCtx) {
    return this.keyboardFactory.getBroadcastSettings(ctx, {
      manualMode: ctx.scene.state.manualRecipients,
      onlyAuthorized: !!ctx.scene.state.filter.onlyAuthorized,
      groupName: ctx.scene.state.filter.groupNames?.join(', ') || null,
    });
  }

  private async renderFilters(ctx: IStepCtx, answerCallback = true) {
    const state = ctx.scene.state;
    const preview = await this.broadcastService.getGroupsPreview(
      SocialType.Vkontakte,
      state.filter,
    );
    state.recipientsCount = state.manualRecipients
      ? state.selectedRecipientIds.length
      : preview.selectedRecipientsCount;
    const groupsText = (state.filter.groupNames || [])
      .slice(0, 6)
      .map((groupName) => {
        const group = preview.institutes
          .flatMap((institute) => institute.groups)
          .find((item) => item.groupName === groupName);
        return `${groupName} — ${group?.recipientsCount || 0}`;
      })
      .join('\n');
    const message = ctx.i18n.t(LocalePhrase.Page_Broadcast_Filters, {
      filter: state.filter,
      recipientsCount: state.recipientsCount,
      groupsCount: state.filter.groupNames?.length || 0,
      groupsText,
      lastInteractionAfter: state.filter.lastInteractionAfter,
      excludeCampaignIds: state.filter.excludeCampaignIds || [],
    });
    const keyboard = this.keyboardFactory
      .getBroadcastFilters(ctx, {
        hasGroups: !!state.filter.groupNames?.length,
        onlyAuthorized: !!state.filter.onlyAuthorized,
        hasActivityFilter: !!state.filter.lastInteractionAfter,
        hasExcludedCampaigns: !!state.filter.excludeCampaignIds?.length,
      })
      .inline();

    if (ctx.isMessageEventContext()) {
      if (answerCallback) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
        });
      }
      await this.editCurrentVkMessage(ctx, message, {
        keep_forward_messages: true,
        keyboard,
      });
      return;
    }

    await ctx.send(message, { keyboard });
  }

  private async renderInstitutes(ctx: IStepCtx, page = 1) {
    const result = await this.groupFilterService.getInstitutesPage({
      social: SocialType.Vkontakte,
      filter: ctx.scene.state.filter,
      page,
      limit: 3,
    });
    await this.editCurrentVkMessage(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterInstitutes, {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      }),
      {
        keep_forward_messages: true,
        keyboard: this.keyboardFactory
          .getPagination({
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            items: result.items.map((institute, index) => ({
              title: `${institute.instituteName} — ${institute.recipientsCount}`,
              payload: {
                broadcastAction: 'filterInstitute',
                page: result.currentPage,
                index,
              },
            })),
            getPagePayload: (nextPage) => ({
              broadcastAction: 'filterInstitutes',
              page: nextPage,
            }),
            additionalButtons: [
              [
                Keyboard.callbackButton({
                  label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
                  payload: { broadcastAction: 'filterGroups' },
                  color: Keyboard.PRIMARY_COLOR,
                }),
              ],
            ],
            pagerMode: 'compact',
          })
          .inline(),
      },
    );
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
    });
  }

  private async getInstituteGroupsPage(
    ctx: IStepCtx,
    institutesPage: number,
    instituteIndex: number,
    groupsPage: number,
  ) {
    const institutes = await this.groupFilterService.getInstitutesPage({
      social: SocialType.Vkontakte,
      filter: ctx.scene.state.filter,
      page: institutesPage,
      limit: 3,
    });
    const institute = institutes.items[instituteIndex];
    if (!institute) return { ...institutes, institute: undefined, items: [] };

    return await this.groupFilterService.getGroupsPage({
      social: SocialType.Vkontakte,
      filter: ctx.scene.state.filter,
      instituteName: institute.instituteName,
      page: groupsPage,
      limit: 2,
    });
  }

  private async renderInstituteGroups(
    ctx: IStepCtx,
    institutesPage: number,
    instituteIndex: number,
    groupsPage: number,
  ) {
    ctx.scene.state.activeGroupFilter = { institutesPage, instituteIndex };
    const result = await this.getInstituteGroupsPage(
      ctx,
      institutesPage,
      instituteIndex,
      groupsPage,
    );
    if (!result.institute) {
      await this.renderInstitutes(ctx, institutesPage);
      return;
    }

    const selected = new Set(ctx.scene.state.filter.groupNames || []);
    const allSelected = result.institute.groups.every((group) =>
      selected.has(group.groupName),
    );
    await this.editCurrentVkMessage(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroups, {
        instituteName: result.institute.instituteName,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      }),
      {
        keep_forward_messages: true,
        keyboard: this.keyboardFactory
          .getPagination({
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            items: result.items.map((group, groupIndex) => ({
              title: `${selected.has(group.groupName) ? '✅ ' : '⬜ '}${group.groupName} — ${group.recipientsCount}`,
              payload: {
                broadcastAction: 'filterGroupToggle',
                page: institutesPage,
                index: instituteIndex,
                groupsPage: result.currentPage,
                groupIndex,
              },
              selected: selected.has(group.groupName),
            })),
            getPagePayload: (nextPage) => ({
              broadcastAction: 'filterGroupsPage',
              groupsPage: nextPage,
            }),
            additionalButtons: [
              [
                Keyboard.callbackButton({
                  label: ctx.i18n.t(
                    LocalePhrase.Button_Broadcast_FilterInstituteToggle,
                    { selected: allSelected },
                  ),
                  payload: {
                    broadcastAction: 'filterInstituteToggle',
                    page: institutesPage,
                    index: instituteIndex,
                    groupsPage: result.currentPage,
                  },
                  color: Keyboard.PRIMARY_COLOR,
                }),
              ],
              [
                Keyboard.callbackButton({
                  label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
                  payload: {
                    broadcastAction: 'filterInstitutes',
                    page: institutesPage,
                  },
                  color: Keyboard.PRIMARY_COLOR,
                }),
              ],
            ],
            pagerMode: 'compact',
          })
          .inline(),
      },
    );
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
    });
  }

  private toggleGroups(state: VkBroadcastState, groupNames: string[]) {
    const selected = new Set(state.filter.groupNames || []);
    const allSelected = groupNames.every((groupName) =>
      selected.has(groupName),
    );
    for (const groupName of groupNames) {
      if (allSelected) selected.delete(groupName);
      else selected.add(groupName);
    }
    const selectedGroupNames = [...selected].sort((first, second) =>
      first.localeCompare(second, 'ru'),
    );
    state.filter.groupNames = selectedGroupNames.length
      ? selectedGroupNames
      : undefined;
    state.filter.groupName = null;
    this.resetManualRecipients(state);
  }

  private async sendSelectedGroups(ctx: IStepCtx) {
    const chunks = this.splitText(
      (ctx.scene.state.filter.groupNames || []).join(', '),
      3500,
    );
    for (const chunk of chunks) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroupsList, {
          groupNames: chunk,
        }),
      );
    }
  }

  private splitText(text: string, limit: number) {
    const chunks: string[] = [];
    let chunk = '';
    for (const item of text.split(', ')) {
      const next = chunk ? `${chunk}, ${item}` : item;
      if (chunk && next.length > limit) {
        chunks.push(chunk);
        chunk = item;
      } else chunk = next;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
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
