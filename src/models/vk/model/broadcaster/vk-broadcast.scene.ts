import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { AttachmentType, Keyboard } from 'vk-io';
import type { MessagesEditParams } from 'vk-io/lib/api/schemas/params';

import { SocialType, VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IStepContext } from '@my-interfaces/vk';

import { VK_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import {
  BroadcastActionKeyboard,
  BroadcastAudienceFilter,
  BroadcastCampaignSettings,
  BroadcastFeedbackButton,
  BroadcastMessageMode,
  BroadcastRecipientAction,
  BroadcastSourceMessage,
  getBroadcastFeedbackAfterClickMode,
  normalizeBroadcastLinkUrl,
} from '../../../broadcast/broadcast.types';
import { BroadcastAudienceGroupFilterService } from '../../../broadcast/filter/broadcast-audience-group-filter.service';
import { ScheduleService } from '../../../schedule/schedule.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

type VkBroadcastState = {
  /** Совместимые параметры выбранной прошлой кампании, без сообщения и history. */
  reusedSettings?: BroadcastCampaignSettings;
  filter: BroadcastAudienceFilter;
  sourceMessage?: BroadcastSourceMessage;
  recipientsCount?: number;
  selectedRecipientIds: number[];
  recipientsPage: number;
  manualRecipients: boolean;
  awaitingSource: boolean;
  awaitingFilter?: 'groups' | 'activity_before' | 'activity_range';
  awaitingFeedbackText?: 'button' | 'response' | 'after';
  awaitingActionText?: BroadcastRecipientAction | 'link';
  awaitingActionLinkUrl?: boolean;
  feedbackButton?: BroadcastFeedbackButton | null;
  actionKeyboard?: BroadcastActionKeyboard | null;
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
      const reusedSettings = ctx.scene.state.reusedSettings;
      ctx.scene.state.filter = reusedSettings
        ? { ...reusedSettings.audienceFilter }
        : {
            hasDM: true,
            isBlockedBot: false,
          };
      ctx.scene.state.selectedRecipientIds = [];
      ctx.scene.state.recipientsPage = 1;
      ctx.scene.state.manualRecipients = false;
      ctx.scene.state.awaitingSource = false;
      ctx.scene.state.awaitingFilter = undefined;
      ctx.scene.state.awaitingFeedbackText = undefined;
      ctx.scene.state.feedbackButton = reusedSettings?.feedbackButton
        ? { ...reusedSettings.feedbackButton }
        : null;
      ctx.scene.state.actionKeyboard =
        reusedSettings?.actionKeyboard.map((item) => ({ ...item })) || [];
      ctx.scene.state.awaitingActionText = undefined;
      ctx.scene.state.awaitingActionLinkUrl = undefined;
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
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_Canceled), {
        keyboard: this.keyboardFactory.getStart(ctx),
      });
      return ctx.scene.leave();
    }

    if ('eventPayload' in ctx) {
      const handled = await this.handleSettingsAction(ctx);
      if (handled) return;
    }

    if (ctx.scene.state.awaitingFeedbackText && ctx.text) {
      await this.applyFeedbackText(
        ctx,
        ctx.scene.state.awaitingFeedbackText,
        ctx.text,
      );
      return;
    }

    if (ctx.scene.state.awaitingActionText && ctx.text) {
      await this.applyActionText(
        ctx,
        ctx.scene.state.awaitingActionText,
        ctx.text,
      );
      return;
    }

    if (ctx.scene.state.awaitingActionLinkUrl && ctx.text) {
      await this.applyActionLinkUrl(ctx, ctx.text);
      return;
    }

    if (ctx.scene.state.awaitingFilter && ctx.text) {
      await this.applyTextFilter(ctx, ctx.scene.state.awaitingFilter, ctx.text);
      return;
    }

    if (ctx.isMessageEventContext()) {
      await ctx.answer({ type: 'show_snackbar', text: '?..' });
      return;
    }

    if (ctx.text === '/next') {
      await this.continueToSource(ctx);
      return;
    }

    if (!ctx.scene.state.awaitingSource) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_SettingsReadyHint));
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
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_Canceled), {
        keyboard: this.keyboardFactory.getStart(ctx),
      });
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
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_Done), {
      keyboard: this.keyboardFactory.getStart(ctx),
    });
    return ctx.scene.leave();
  }

  private getSourceMessage(
    ctx: IMessageContext,
  ): BroadcastSourceMessage | null {
    if (ctx.hasAttachments(AttachmentType.STICKER)) {
      const stickers = ctx.getAttachments(AttachmentType.STICKER);
      return stickers[0]?.id
        ? { stickerId: stickers[0].id, messageId: ctx.id }
        : null;
    }

    const attachment = this.serializeAttachments(ctx);
    if (attachment) {
      return {
        ...(ctx.hasText ? { text: ctx.text } : {}),
        attachment,
        messageId: ctx.id,
      };
    }

    if (ctx.hasText) {
      return { text: ctx.text, messageId: ctx.id };
    }

    return null;
  }

  /** Собирает attachable-вложения VK в CSV-строку для `messages.send`. */
  private serializeAttachments(ctx: IMessageContext): string | null {
    const attachments = ctx.attachments
      .filter((attachment) => attachment.canBeAttached)
      .map(String)
      .filter((attachment) => !attachment.startsWith('[object '));

    return attachments.length ? attachments.join(',') : null;
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
      | 'filterGroupsSelectionClear'
      | 'filterGroupsShow'
      | 'filterInstitutes'
      | 'filterInstitute'
      | 'filterGroupsPage'
      | 'filterGroupToggle'
      | 'filterInstituteToggle'
      | 'continue'
      | 'feedbackSettings'
      | 'feedbackBack'
      | 'feedbackToggle'
      | 'feedbackText'
      | 'feedbackResponse'
      | 'feedbackAfterDelete'
      | 'feedbackAfterKeep'
      | 'feedbackAfterReplace'
      | 'feedbackAfterText'
      | 'actionSettings'
      | 'actionTextSelector'
      | 'actionBack'
      | 'actionSelectGroupToggle'
      | 'actionSelectGroupText'
      | 'actionAuthToggle'
      | 'actionAuthText'
      | 'actionStartToggle'
      | 'actionStartText'
      | 'actionUnsubscribeToggle'
      | 'actionUnsubscribeText'
      | 'actionLinkToggle'
      | 'actionLinkText'
      | 'actionLinkUrl'
      | 'filterActivityBefore'
      | 'filterActivityRange'
      | 'filterActivityClear'
      | 'filterExcludeCampaignToggle'
      | 'filterExcludeCampaignDone'
      | undefined;
    if (!action) return false;

    if (action === 'continue') {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      await this.continueToSource(ctx);
      return true;
    }

    if (action === 'feedbackSettings') {
      ctx.scene.state.awaitingFeedbackText = undefined;
      await this.editCurrentVkMessage(ctx, this.renderFeedbackSettings(ctx), {
        keep_forward_messages: true,
        keyboard: this.getFeedbackSettingsKeyboard(ctx).inline(),
      });
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'actionSettings') {
      ctx.scene.state.awaitingActionText = undefined;
      await this.renderActionSettings(ctx);
      return true;
    }

    if (action === 'actionTextSelector') {
      await this.renderActionTextSelector(ctx);
      return true;
    }

    if (action === 'actionBack') {
      await this.renderSettingsScreen(ctx);
      return true;
    }

    if (
      action === 'actionSelectGroupToggle' ||
      action === 'actionAuthToggle' ||
      action === 'actionStartToggle' ||
      action === 'actionUnsubscribeToggle'
    ) {
      this.toggleRecipientAction(
        ctx.scene.state,
        action === 'actionAuthToggle'
          ? 'auth'
          : action === 'actionStartToggle'
            ? 'start'
            : action === 'actionUnsubscribeToggle'
              ? 'unsubscribe'
              : 'select_group',
      );
      await this.renderActionSettings(ctx);
      return true;
    }

    if (
      action === 'actionSelectGroupText' ||
      action === 'actionAuthText' ||
      action === 'actionStartText' ||
      action === 'actionUnsubscribeText'
    ) {
      const recipientAction =
        action === 'actionAuthText'
          ? 'auth'
          : action === 'actionStartText'
            ? 'start'
            : action === 'actionUnsubscribeText'
              ? 'unsubscribe'
              : 'select_group';
      if (!this.getRecipientActionButton(ctx.scene.state, recipientAction)) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(
            LocalePhrase.Broadcast_Notification_ActionUnavailable,
          ),
        });
        return true;
      }
      ctx.scene.state.awaitingActionText = recipientAction;
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionText),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastActionTextPrompt(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'actionLinkToggle') {
      const link = this.getRecipientActionButton(ctx.scene.state, 'link');
      ctx.scene.state.actionKeyboard = link
        ? (ctx.scene.state.actionKeyboard || []).filter(
            (item) => item.type !== 'link',
          )
        : [
            ...(ctx.scene.state.actionKeyboard || []),
            { type: 'link', text: 'Открыть', url: 'https://ystuty.ru/' },
          ];
      await this.renderActionSettings(ctx);
      return true;
    }

    if (action === 'actionLinkText') {
      if (!this.getRecipientActionButton(ctx.scene.state, 'link')) return true;
      ctx.scene.state.awaitingActionText = 'link';
      ctx.scene.state.awaitingActionLinkUrl = undefined;
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionText),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastActionTextPrompt(ctx)
            .inline(),
        },
      );
      return true;
    }

    if (action === 'actionLinkUrl') {
      if (!this.getRecipientActionButton(ctx.scene.state, 'link')) return true;
      ctx.scene.state.awaitingActionText = undefined;
      ctx.scene.state.awaitingActionLinkUrl = true;
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionLinkUrl),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastActionTextPrompt(ctx)
            .inline(),
        },
      );
      return true;
    }

    if (action === 'feedbackBack') {
      await this.renderSettingsScreen(ctx);
      return true;
    }

    if (action === 'feedbackToggle') {
      ctx.scene.state.awaitingFeedbackText = undefined;
      ctx.scene.state.feedbackButton = ctx.scene.state.feedbackButton
        ? null
        : { text: '🫡' };
      await this.editCurrentVkMessage(ctx, this.renderFeedbackSettings(ctx), {
        keep_forward_messages: true,
        keyboard: this.getFeedbackSettingsKeyboard(ctx).inline(),
      });
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'feedbackText') {
      ctx.scene.state.awaitingFeedbackText = 'button';
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackText),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastFeedbackTextPrompt(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'feedbackResponse') {
      if (!ctx.scene.state.feedbackButton) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackRequired),
        });
        return true;
      }
      ctx.scene.state.awaitingFeedbackText = 'response';
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackResponseText),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastFeedbackTextPrompt(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (
      action === 'feedbackAfterDelete' ||
      action === 'feedbackAfterKeep' ||
      action === 'feedbackAfterReplace'
    ) {
      const feedbackButton = ctx.scene.state.feedbackButton;
      if (!feedbackButton) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackRequired),
        });
        return true;
      }
      ctx.scene.state.awaitingFeedbackText = undefined;
      const mode = {
        feedbackAfterDelete: 'delete',
        feedbackAfterKeep: 'keep',
        feedbackAfterReplace: 'replace',
      }[action] as 'delete' | 'keep' | 'replace';
      feedbackButton.afterClickMode = mode;
      feedbackButton.afterClickText =
        mode === 'replace' ? feedbackButton.afterClickText || '✅' : null;
      await this.editCurrentVkMessage(ctx, this.renderFeedbackSettings(ctx), {
        keep_forward_messages: true,
        keyboard: this.getFeedbackSettingsKeyboard(ctx).inline(),
      });
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'feedbackAfterText') {
      if (!ctx.scene.state.feedbackButton) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackRequired),
        });
        return true;
      }
      ctx.scene.state.awaitingFeedbackText = 'after';
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackAfterText),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastFeedbackTextPrompt(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

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
        ctx.scene.state.filter.onlyAuthorized === undefined
          ? true
          : ctx.scene.state.filter.onlyAuthorized
            ? false
            : undefined;
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

    if (action === 'filterGroupsSelectionClear') {
      ctx.scene.state.filter.groupName = null;
      ctx.scene.state.filter.groupNames = undefined;
      this.resetManualRecipients(ctx.scene.state);
      const active = ctx.scene.state.activeGroupFilter;
      if (!active) {
        await this.renderInstitutes(ctx);
      } else {
        await this.renderInstituteGroups(
          ctx,
          active.institutesPage,
          active.instituteIndex,
          1,
        );
      }
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

    if (action === 'filterActivity') {
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterActivityMode),
        {
          keep_forward_messages: true,
          keyboard: this.keyboardFactory
            .getBroadcastActivityFilterMenu(ctx)
            .inline(),
        },
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
      });
      return true;
    }

    if (action === 'filterActivityBefore' || action === 'filterActivityRange') {
      ctx.scene.state.awaitingFilter =
        action === 'filterActivityRange' ? 'activity_range' : 'activity_before';
      await this.editCurrentVkMessage(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterActivityText),
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

    if (action === 'filterActivityClear') {
      ctx.scene.state.filter.lastInteractionAfter = undefined;
      ctx.scene.state.filter.lastInteractionBefore = undefined;
      ctx.scene.state.awaitingFilter = undefined;
      this.resetManualRecipients(ctx.scene.state);
      await this.renderFilters(ctx);
      return true;
    }

    if (action === 'filterExcludeCampaigns') {
      if (ctx.scene.state.filter.excludeCampaignIds?.length) {
        ctx.scene.state.filter.excludeCampaignIds = undefined;
        this.resetManualRecipients(ctx.scene.state);
        await this.renderFilters(ctx);
        return true;
      }
      await this.renderExcludeCampaignsSelector(
        ctx,
        Number(ctx.eventPayload.page) || 1,
      );
      return true;
    }

    if (action === 'filterExcludeCampaignToggle') {
      const campaignId = Number(ctx.eventPayload.campaignId);
      const selected = new Set(ctx.scene.state.filter.excludeCampaignIds || []);
      if (selected.has(campaignId)) selected.delete(campaignId);
      else selected.add(campaignId);
      ctx.scene.state.filter.excludeCampaignIds = [...selected].sort(
        (first, second) => first - second,
      );
      this.resetManualRecipients(ctx.scene.state);
      await this.renderExcludeCampaignsSelector(
        ctx,
        Number(ctx.eventPayload.page) || 1,
      );
      return true;
    }

    if (action === 'filterExcludeCampaignDone') {
      await this.renderFilters(ctx);
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
        feedbackButton: ctx.scene.state.feedbackButton,
        actionKeyboard: ctx.scene.state.actionKeyboard,
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
    ctx.scene.state.awaitingSource = false;
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
      selectedRecipientIds: ctx.scene.state.selectedRecipientIds,
      audienceMode: ctx.scene.state.manualRecipients ? 'manual' : 'all',
      feedbackButton: ctx.scene.state.feedbackButton,
      feedbackAfterClickSummary: this.renderFeedbackAfterClickSummary(
        ctx.scene.state.feedbackButton,
      ),
      actionKeyboard: ctx.scene.state.actionKeyboard,
      actionKeyboardSummary: this.renderActionKeyboardSummary(
        ctx.scene.state.actionKeyboard,
      ),
    });
  }

  private renderFeedbackSettings(ctx: IStepCtx) {
    return ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackSettings, {
      feedbackButton: ctx.scene.state.feedbackButton || { text: '-' },
      feedbackAfterClickSummary: this.renderFeedbackAfterClickSummary(
        ctx.scene.state.feedbackButton,
      ),
    });
  }

  /** Возвращает текст выбранного режима для экранов администратора. */
  private renderFeedbackAfterClickSummary(
    feedbackButton?: BroadcastFeedbackButton | null,
  ) {
    const mode = getBroadcastFeedbackAfterClickMode(feedbackButton);
    if (mode === 'keep') return 'кнопка остаётся';
    if (mode === 'replace') {
      return `заменяется на «${feedbackButton?.afterClickText || '✅'}»`;
    }
    return 'кнопка удаляется';
  }

  /** Формирует многострочный список настроенных action-кнопок для экрана администратора. */
  private renderActionKeyboardSummary(
    actionKeyboard?: BroadcastActionKeyboard | null,
  ) {
    const labels: Record<BroadcastRecipientAction | 'link', string> = {
      select_group: 'Выбор группы',
      auth: 'ЯГТУ.ID',
      start: 'Стартовое меню',
      unsubscribe: 'Отключение уведомлений',
      link: 'Ссылка',
    };
    const defaultTexts: Record<BroadcastRecipientAction | 'link', string> = {
      select_group: 'Выбрать актуальную группу',
      auth: 'Подключить или обновить ЯГТУ.ID',
      start: 'Начать',
      unsubscribe: '🔕 Отключить уведомления',
      link: 'Открыть',
    };

    return (actionKeyboard || []).length
      ? (actionKeyboard || [])
          .map(
            (item) =>
              `  • ${labels[item.type]}: «${
                item.text || defaultTexts[item.type]
              }»${item.type === 'link' ? ` → ${item.url}` : ''}`,
          )
          .join('\n')
      : '  • нет';
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
    } else {
      const range = this.parseActivityFilter(text, awaitingFilter);
      if (!range) {
        await ctx.send(
          ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterActivityText),
        );
        return;
      }
      ctx.scene.state.filter.lastInteractionAfter = range.after;
      ctx.scene.state.filter.lastInteractionBefore = range.before;
    }

    ctx.scene.state.awaitingFilter = undefined;
    this.resetManualRecipients(ctx.scene.state);
    await this.renderFilters(ctx, false);
  }

  private async applyFeedbackText(
    ctx: IStepCtx,
    target: NonNullable<VkBroadcastState['awaitingFeedbackText']>,
    text: string,
  ) {
    const value = text.trim();
    const maxLength = target === 'response' ? 200 : 40;
    if (!value || value.length > maxLength) {
      await ctx.send(
        ctx.i18n.t(
          target === 'response'
            ? LocalePhrase.Page_Broadcast_FeedbackResponseTextInvalid
            : LocalePhrase.Page_Broadcast_FeedbackTextInvalid,
        ),
      );
      return;
    }

    if (target === 'button') {
      ctx.scene.state.feedbackButton = { text: value };
    } else if (ctx.scene.state.feedbackButton) {
      if (target === 'response') {
        ctx.scene.state.feedbackButton.responseText = value;
      } else {
        ctx.scene.state.feedbackButton.afterClickMode = 'replace';
        ctx.scene.state.feedbackButton.afterClickText = value;
      }
    }
    ctx.scene.state.awaitingFeedbackText = undefined;
    await this.refreshRecipientsCount(ctx.scene.state);
    await ctx.send(this.renderFeedbackSettings(ctx), {
      keyboard: this.getFeedbackSettingsKeyboard(ctx).inline(),
    });
  }

  private parseActivityFilter(
    text: string,
    mode: 'activity_before' | 'activity_range',
  ) {
    const dates = text
      .trim()
      .split(/\s*(?:-|—|–)\s*/)
      .map((value) => this.parseMoscowDate(value));
    if (
      (mode === 'activity_before' && dates.length !== 1) ||
      dates.some((date) => !date)
    ) {
      return null;
    }
    if (mode === 'activity_before') {
      return { before: this.addMoscowDays(dates[0]!, 1).toISOString() };
    }
    if (dates.length !== 2 || dates[0]! > dates[1]!) return null;

    return {
      after: dates[0]!.toISOString(),
      before: this.addMoscowDays(dates[1]!, 1).toISOString(),
    };
  }

  /** Календарные даты рассылки трактуются в Europe/Moscow независимо от timezone процесса. */
  private parseMoscowDate(value: string) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
    if (!match) return null;
    const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00+03:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private addMoscowDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private renderActivityFilter(filter: BroadcastAudienceFilter) {
    const format = (value: string | number) =>
      new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
      }).format(new Date(value));
    if (filter.lastInteractionAfter && filter.lastInteractionBefore) {
      return `с ${format(filter.lastInteractionAfter)} по ${format(
        new Date(filter.lastInteractionBefore).getTime() - 1,
      )}`;
    }
    if (filter.lastInteractionBefore) {
      return `до ${format(
        new Date(filter.lastInteractionBefore).getTime() - 1,
      )}`;
    }
    return null;
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
      onlyAuthorized: ctx.scene.state.filter.onlyAuthorized,
      groupName: ctx.scene.state.filter.groupNames?.join(', ') || null,
      feedbackButton: ctx.scene.state.feedbackButton,
      actionKeyboard: ctx.scene.state.actionKeyboard,
    });
  }

  private getFeedbackSettingsKeyboard(ctx: IStepCtx) {
    return this.keyboardFactory.getBroadcastFeedbackSettings(
      ctx,
      ctx.scene.state.feedbackButton,
    );
  }

  private async renderActionSettings(ctx: IStepCtx) {
    const message = ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionSettings, {
      actionKeyboardSummary: this.renderActionKeyboardSummary(
        ctx.scene.state.actionKeyboard,
      ),
    });
    const keyboard = this.keyboardFactory
      .getBroadcastActionSettings(ctx, ctx.scene.state.actionKeyboard || [])
      .inline();

    if (!ctx.isMessageEventContext()) {
      await ctx.send(message, { keyboard });
      return;
    }

    await this.editCurrentVkMessage(ctx, message, {
      keep_forward_messages: true,
      keyboard,
    });
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
    });
  }

  /** Отдельный экран не позволяет превысить лимит VK inline-клавиатуры. */
  private async renderActionTextSelector(ctx: IStepCtx) {
    await this.editCurrentVkMessage(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionTextSelect),
      {
        keep_forward_messages: true,
        keyboard: this.keyboardFactory
          .getBroadcastActionTextSelector(
            ctx,
            ctx.scene.state.actionKeyboard || [],
          )
          .inline(),
      },
    );
  }

  private getRecipientActionButton(
    state: VkBroadcastState,
    action: BroadcastRecipientAction | 'link',
  ) {
    return state.actionKeyboard?.find((item) => item.type === action);
  }

  private toggleRecipientAction(
    state: VkBroadcastState,
    action: BroadcastRecipientAction,
  ) {
    const actionKeyboard = state.actionKeyboard || [];
    state.actionKeyboard = actionKeyboard.some((item) => item.type === action)
      ? actionKeyboard.filter((item) => item.type !== action)
      : [...actionKeyboard, { type: action }];
  }

  private async applyActionText(
    ctx: IStepCtx,
    action: BroadcastRecipientAction | 'link',
    text: string,
  ) {
    const value = text.trim();
    if (!value || value.length > 40) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionTextInvalid));
      return;
    }
    ctx.scene.state.actionKeyboard = (ctx.scene.state.actionKeyboard || []).map(
      (item) => (item.type === action ? { ...item, text: value } : item),
    );
    ctx.scene.state.awaitingActionText = undefined;
    await ctx.send(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionSettings, {
        actionKeyboardSummary: this.renderActionKeyboardSummary(
          ctx.scene.state.actionKeyboard,
        ),
      }),
      {
        keyboard: this.keyboardFactory
          .getBroadcastActionSettings(ctx, ctx.scene.state.actionKeyboard)
          .inline(),
      },
    );
  }

  private async applyActionLinkUrl(ctx: IStepCtx, text: string) {
    const url = normalizeBroadcastLinkUrl(text);
    if (!url) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_ActionLinkUrlInvalid),
      );
      return;
    }
    ctx.scene.state.actionKeyboard = (ctx.scene.state.actionKeyboard || []).map(
      (item) => (item.type === 'link' ? { ...item, url } : item),
    );
    ctx.scene.state.awaitingActionLinkUrl = undefined;
    await this.renderActionSettings(ctx);
  }

  private async renderSettingsScreen(ctx: IStepCtx) {
    await this.editCurrentVkMessage(ctx, this.renderSettings(ctx), {
      keep_forward_messages: true,
      keyboard: this.getSettingsKeyboard(ctx).inline(),
    });
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
    });
  }

  private async continueToSource(ctx: IStepCtx) {
    ctx.scene.state.awaitingSource = true;
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_SendSample), {
      keyboard: this.keyboardFactory.getClose(ctx),
    });
  }

  private async renderExcludeCampaignsSelector(ctx: IStepCtx, page: number) {
    const campaigns = await this.broadcastService.getCampaignsPage({
      social: SocialType.Vkontakte,
      page,
      limit: 4,
    });
    const selected = new Set(ctx.scene.state.filter.excludeCampaignIds || []);
    await this.editCurrentVkMessage(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterExcludeCampaigns, {
        selectedCampaignIds: [...selected].sort(
          (first, second) => first - second,
        ),
        currentPage: campaigns.currentPage,
        totalPages: campaigns.totalPages,
      }),
      {
        keep_forward_messages: true,
        keyboard: this.keyboardFactory
          .getBroadcastExcludeCampaignsSelector({
            ctx,
            currentPage: campaigns.currentPage,
            totalPages: campaigns.totalPages,
            selectedCount: selected.size,
            items: campaigns.items.map((campaign) => ({
              id: campaign.id,
              selected: selected.has(campaign.id),
              title: `№${campaign.id} • ${campaign.status}`,
            })),
          })
          .inline(),
      },
    );
    await ctx.answer({
      type: 'show_snackbar',
      text: ctx.i18n.t(LocalePhrase.Broadcast_Notification_Settings),
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
      activityText: this.renderActivityFilter(state.filter),
      excludeCampaignIds: state.filter.excludeCampaignIds || [],
    });
    const keyboard = this.keyboardFactory
      .getBroadcastFilters(ctx, {
        hasGroups: !!state.filter.groupNames?.length,
        onlyAuthorized: state.filter.onlyAuthorized,
        hasActivityFilter:
          !!state.filter.lastInteractionAfter ||
          !!state.filter.lastInteractionBefore,
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
        selectedGroupsCount: selected.size,
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
              ...(selected.size
                ? [
                    [
                      Keyboard.callbackButton({
                        label: ctx.i18n.t(
                          LocalePhrase.Button_Broadcast_FilterGroupsClear,
                        ),
                        payload: {
                          broadcastAction: 'filterGroupsSelectionClear',
                        },
                        color: Keyboard.NEGATIVE_COLOR,
                      }),
                    ],
                  ]
                : []),
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
    const groupNames = ctx.scene.state.filter.groupNames || [];
    if (!groupNames.length) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroupsEmpty));
      return;
    }
    const chunks = this.splitText(groupNames.join(', '), 3500);
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
