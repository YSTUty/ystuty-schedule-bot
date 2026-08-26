import {
  Action,
  Command,
  Ctx,
  Hears,
  Wizard,
  WizardStep,
} from '@xtcry/nestjs-telegraf';

import { Markup } from 'telegraf';

import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/telegram';

import { TELEGRAM_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import {
  BroadcastAudienceFilter,
  BroadcastFeedbackButton,
  BroadcastMessageMode,
  BroadcastSourceMessage,
} from '../../../broadcast/broadcast.types';
import { BroadcastAudienceGroupFilterService } from '../../../broadcast/filter/broadcast-audience-group-filter.service';
import { ScheduleService } from '../../../schedule/schedule.service';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

type TelegramBroadcastState = {
  filter: BroadcastAudienceFilter;
  sourceMessage?: BroadcastSourceMessage;
  recipientsCount?: number;
  selectedRecipientIds: number[];
  recipientsPage: number;
  manualRecipients: boolean;
  awaitingFilter?: 'groups' | 'activity' | 'excludeCampaigns';
  awaitingFeedbackText?: 'button' | 'response' | 'after';
  feedbackButton?: BroadcastFeedbackButton | null;
  activeGroupFilter?: { institutesPage: number; instituteIndex: number };
  mode: BroadcastMessageMode.Copy | BroadcastMessageMode.Forward;
};

type IStepCtx = IStepContext<TelegramBroadcastState>;

@Wizard(TELEGRAM_BROADCAST_SCENE)
export class TelegramBroadcastScene extends BaseScene {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly groupFilterService: BroadcastAudienceGroupFilterService,
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  @WizardStep(1)
  async onEnter(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.filter = {
      hasDM: true,
      isBlockedBot: false,
    };
    state.mode = BroadcastMessageMode.Copy;
    state.selectedRecipientIds = [];
    state.recipientsPage = 1;
    state.manualRecipients = false;
    state.awaitingFilter = undefined;
    state.awaitingFeedbackText = undefined;
    state.feedbackButton = null;

    const count = await this.broadcastService.countRecipients(
      SocialType.Telegram,
      state.filter,
    );
    state.recipientsCount = count;

    await ctx.replyWithHTML(
      this.renderSettings(ctx, state),
      this.getSettingsKeyboard(ctx, state),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  @Command('next')
  async onNext(@Ctx() ctx: IStepCtx) {
    if (ctx.scene.state.awaitingFilter) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroupsText),
      );
      return;
    }

    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_SendSample),
      Markup.keyboard([['/cancel']]).resize(),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  @Hears(/.+/)
  async onStep2Hint(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    if (state.awaitingFeedbackText) {
      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      await this.applyFeedbackText(ctx, state.awaitingFeedbackText, text);
      return;
    }
    if (state.awaitingFilter) {
      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      await this.applyTextFilter(ctx, state.awaitingFilter, text);
      return;
    }

    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_SettingsReadyHint),
    );
  }

  @WizardStep(2)
  @Action('broadcast:wizard:feedback:toggle')
  async onFeedbackToggle(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.awaitingFeedbackText = undefined;
    state.feedbackButton = state.feedbackButton ? null : { text: '🫡' };
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(this.renderSettings(ctx, state), {
      parse_mode: 'HTML',
      ...this.getSettingsKeyboard(ctx, state),
    });
  }

  @WizardStep(2)
  @Action('broadcast:wizard:feedback:text')
  async onFeedbackText(@Ctx() ctx: IStepCtx) {
    ctx.scene.state.awaitingFeedbackText = 'button';
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackText),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastFilterTextPrompt(ctx),
      },
    );
  }

  @WizardStep(2)
  @Action('broadcast:wizard:feedback:response')
  async onFeedbackResponse(@Ctx() ctx: IStepCtx) {
    if (!ctx.scene.state.feedbackButton) {
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackRequired),
      );
      return;
    }
    ctx.scene.state.awaitingFeedbackText = 'response';
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackResponseText),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastFilterTextPrompt(ctx),
      },
    );
  }

  @WizardStep(2)
  @Action('broadcast:wizard:feedback:after-toggle')
  async onFeedbackAfterToggle(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.awaitingFeedbackText = undefined;
    if (!state.feedbackButton) {
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackRequired),
      );
      return;
    }
    state.feedbackButton.afterClickText = state.feedbackButton.afterClickText
      ? null
      : '✅';
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(this.renderSettings(ctx, state), {
      parse_mode: 'HTML',
      ...this.getSettingsKeyboard(ctx, state),
    });
  }

  @WizardStep(2)
  @Action('broadcast:wizard:feedback:after-text')
  async onFeedbackAfterText(@Ctx() ctx: IStepCtx) {
    if (!ctx.scene.state.feedbackButton) {
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackRequired),
      );
      return;
    }
    ctx.scene.state.awaitingFeedbackText = 'after';
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FeedbackAfterText),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastFilterTextPrompt(ctx),
      },
    );
  }

  @WizardStep(2)
  @Action(/broadcast:wizard:audience:(?<mode>all|manual)/)
  async onAudienceMode(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.manualRecipients = ctx.match!.groups!.mode === 'manual';
    await this.refreshRecipientsCount(state);
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(this.renderSettings(ctx, state), {
      parse_mode: 'HTML',
      ...this.getSettingsKeyboard(ctx, state),
    });
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filters')
  async onFilters(@Ctx() ctx: IStepCtx) {
    await this.renderFilters(ctx);
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:authorized')
  async onAuthorizedFilterToggle(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.filter.onlyAuthorized = !state.filter.onlyAuthorized;
    this.resetManualRecipients(state);
    await this.refreshRecipientsCount(state);
    await ctx.tryAnswerCbQuery();
    await this.renderFilters(ctx, false);
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:groups')
  async onGroupFilter(@Ctx() ctx: IStepCtx) {
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroupsMenu),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastGroupFilterMenu(ctx),
      },
    );
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:groups:text')
  async onGroupFilterText(@Ctx() ctx: IStepCtx) {
    ctx.scene.state.awaitingFilter = 'groups';
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroupsText),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastGroupFilterTextPrompt(ctx),
      },
    );
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:groups:text:show')
  async onShowGroupFilterText(@Ctx() ctx: IStepCtx) {
    await ctx.tryAnswerCbQuery();
    await this.sendSelectedGroups(ctx);
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:groups:text:cancel')
  async onGroupFilterTextCancel(@Ctx() ctx: IStepCtx) {
    ctx.scene.state.awaitingFilter = undefined;
    await this.renderFilters(ctx);
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:groups:clear')
  async onGroupFilterReset(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.filter.groupName = null;
    state.filter.groupNames = undefined;
    state.awaitingFilter = undefined;
    this.resetManualRecipients(state);
    await this.renderFilters(ctx);
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:groups:show')
  async onShowGroupFilter(@Ctx() ctx: IStepCtx) {
    await ctx.tryAnswerCbQuery();
    await this.sendSelectedGroups(ctx);
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:activity')
  async onActivityFilter(@Ctx() ctx: IStepCtx) {
    if (ctx.scene.state.filter.lastInteractionAfter) {
      ctx.scene.state.filter.lastInteractionAfter = undefined;
      this.resetManualRecipients(ctx.scene.state);
      await this.renderFilters(ctx);
      return;
    }
    ctx.scene.state.awaitingFilter = 'activity';
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterActivityText),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastFilterTextPrompt(ctx),
      },
    );
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:exclude-campaigns')
  async onExcludeCampaignsFilter(@Ctx() ctx: IStepCtx) {
    if (ctx.scene.state.filter.excludeCampaignIds?.length) {
      ctx.scene.state.filter.excludeCampaignIds = undefined;
      this.resetManualRecipients(ctx.scene.state);
      await this.renderFilters(ctx);
      return;
    }
    ctx.scene.state.awaitingFilter = 'excludeCampaigns';
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterExcludeCampaignsText),
      {
        parse_mode: 'HTML',
        ...this.keyboardFactory.getBroadcastFilterTextPrompt(ctx),
      },
    );
  }

  @WizardStep(2)
  @Action('broadcast:wizard:filter:text:cancel')
  async onTextFilterCancel(@Ctx() ctx: IStepCtx) {
    ctx.scene.state.awaitingFilter = undefined;
    await this.renderFilters(ctx);
  }

  @WizardStep(2)
  @Action(/broadcast:wizard:filter:institutes:(?<page>[0-9]+)/)
  @Action(/pager:broadcast-filter-institutes:(?<page>[0-9]+)/)
  async onInstitutesPage(@Ctx() ctx: IStepCtx) {
    await this.renderInstitutes(ctx, Number(ctx.match!.groups!.page));
  }

  @WizardStep(2)
  @Action(/broadcast:wizard:filter:institute:(?<page>[0-9]+):(?<index>[0-9]+)/)
  async onInstitute(@Ctx() ctx: IStepCtx) {
    await this.renderInstituteGroups(
      ctx,
      Number(ctx.match!.groups!.page),
      Number(ctx.match!.groups!.index),
      1,
    );
  }

  @WizardStep(2)
  @Action(
    /broadcast:wizard:filter:groups:(?<page>[0-9]+):(?<index>[0-9]+):(?<groupsPage>[0-9]+)/,
  )
  @Action(/pager:broadcast-filter-groups:(?<groupsPage>[0-9]+)/)
  async onInstituteGroupsPage(@Ctx() ctx: IStepCtx) {
    const { page, index, groupsPage } = ctx.match!.groups!;
    const active = ctx.scene.state.activeGroupFilter;
    await this.renderInstituteGroups(
      ctx,
      Number(page || active?.institutesPage),
      Number(index || active?.instituteIndex),
      Number(groupsPage),
    );
  }

  @WizardStep(2)
  @Action(
    /broadcast:wizard:filter:group:(?<page>[0-9]+):(?<index>[0-9]+):(?<groupsPage>[0-9]+):(?<groupIndex>[0-9]+)/,
  )
  async onGroupToggle(@Ctx() ctx: IStepCtx) {
    const { page, index, groupsPage, groupIndex } = ctx.match!.groups!;
    const groupPage = await this.getInstituteGroupsPage(
      ctx,
      Number(page),
      Number(index),
      Number(groupsPage),
    );
    const group = groupPage.items[Number(groupIndex)];
    if (group) this.toggleGroups(ctx.scene.state, [group.groupName]);
    await this.renderInstituteGroups(
      ctx,
      Number(page),
      Number(index),
      Number(groupsPage),
    );
  }

  @WizardStep(2)
  @Action(
    /broadcast:wizard:filter:institute:toggle:(?<page>[0-9]+):(?<index>[0-9]+):(?<groupsPage>[0-9]+)/,
  )
  async onInstituteToggle(@Ctx() ctx: IStepCtx) {
    const { page, index, groupsPage } = ctx.match!.groups!;
    const groupPage = await this.getInstituteGroupsPage(
      ctx,
      Number(page),
      Number(index),
      Number(groupsPage),
    );
    if (groupPage.institute) {
      this.toggleGroups(
        ctx.scene.state,
        groupPage.institute.groups.map((group) => group.groupName),
      );
    }
    await this.renderInstituteGroups(
      ctx,
      Number(page),
      Number(index),
      Number(groupsPage),
    );
  }

  @WizardStep(2)
  @Action(/broadcast:wizard:recipients:(?<page>[0-9]+)/)
  @Action(/pager:broadcast-recipients:(?<page>[0-9]+)/)
  async onRecipientsPage(@Ctx() ctx: IStepCtx) {
    ctx.scene.state.recipientsPage = Number(ctx.match!.groups!.page) || 1;
    ctx.scene.state.manualRecipients = true;
    await this.renderRecipientsSelector(ctx);
  }

  @WizardStep(2)
  @Action(/broadcast:wizard:recipient:(?<id>[0-9]+)/)
  async onRecipientToggle(@Ctx() ctx: IStepCtx) {
    const id = Number(ctx.match!.groups!.id);
    const selected = new Set(ctx.scene.state.selectedRecipientIds);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    ctx.scene.state.selectedRecipientIds = [...selected];
    ctx.scene.state.manualRecipients = true;
    await this.renderRecipientsSelector(ctx);
  }

  @WizardStep(2)
  @Action('broadcast:wizard:settings')
  async onBackToSettings(@Ctx() ctx: IStepCtx) {
    await this.refreshRecipientsCount(ctx.scene.state);
    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(this.renderSettings(ctx, ctx.scene.state), {
      parse_mode: 'HTML',
      ...this.getSettingsKeyboard(ctx, ctx.scene.state),
    });
  }

  @WizardStep(3)
  async onMessage(@Ctx() ctx: IStepCtx) {
    if (!ctx.message || !('message_id' in ctx.message) || !ctx.chat) return;

    const state = ctx.scene.state;
    state.sourceMessage = {
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      text:
        ('text' in ctx.message && ctx.message.text) ||
        ('caption' in ctx.message ? ctx.message.caption : undefined),
    };

    const count = await this.broadcastService.countRecipients(
      SocialType.Telegram,
      state.filter,
    );
    state.recipientsCount = this.getEffectiveRecipientsCount(state, count);

    if (state.manualRecipients && state.selectedRecipientIds.length === 0) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_NoRecipients),
      );
      return;
    }

    await ctx.replyWithHTML(this.renderReady(ctx, state), {
      reply_parameters: { message_id: ctx.message.message_id },
      ...this.getConfirmKeyboard(ctx, state),
    });
    ctx.wizard.next();
  }

  @WizardStep(4)
  @Command('back')
  @Action('broadcast:wizard:back')
  async onBack(@Ctx() ctx: IStepCtx) {
    await ctx.tryAnswerCbQuery();
    await this.backToSettings(ctx);
  }

  @WizardStep(4)
  @Command('send')
  @Action('broadcast:wizard:send')
  async onSend(@Ctx() ctx: IStepCtx) {
    await ctx.tryAnswerCbQuery();

    const state = ctx.scene.state;
    if (!state.sourceMessage) {
      ctx.wizard.selectStep(2);
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_SourceRequired),
      );
      return;
    }

    if (state.manualRecipients && state.selectedRecipientIds.length === 0) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Broadcast_NoRecipients),
      );
      return;
    }

    const campaign = await this.createCampaignOrReplyActive(ctx, state);
    if (!campaign) return;

    if (ctx.callbackQuery?.message) {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }

    const queuedMessage = await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_Queued, {
        campaignId: campaign.id,
        recipientsCount: campaign.totalCount,
      }),
      {
        reply_parameters: { message_id: state.sourceMessage.messageId! },
        ...this.keyboardFactory.getBroadcastQueueControls(ctx, true),
      },
    );
    await this.broadcastService.updateCampaignSourceMessage(campaign.id, {
      ...campaign.sourceMessage,
      reportMessage: {
        chatId: queuedMessage.chat.id,
        messageId: queuedMessage.message_id,
      },
    });
    await this.leaveScene(ctx);
  }

  @WizardStep(4)
  @Action(/broadcast:wizard:mode:(?<mode>copy|forward)/)
  async onModeToggle(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.mode =
      ctx.match!.groups!.mode === BroadcastMessageMode.Forward
        ? BroadcastMessageMode.Forward
        : BroadcastMessageMode.Copy;

    await ctx.tryAnswerCbQuery(
      ctx.i18n.t(LocalePhrase.Broadcast_Notification_ModeChanged, {
        mode: state.mode,
      }),
    );
    await ctx.editMessageText(this.renderReady(ctx, state), {
      parse_mode: 'HTML',
      ...this.getConfirmKeyboard(ctx, state),
    });
  }

  @WizardStep(4)
  async onStep4Fallback(@Ctx() ctx: IStepCtx) {
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_SendCommandHint),
    );
  }

  private renderSettings(ctx: IStepCtx, state: TelegramBroadcastState): string {
    return ctx.i18n.t(LocalePhrase.Page_Broadcast_Settings, {
      filter: state.filter,
      recipientsCount: state.recipientsCount ?? 0,
      selectedCount: state.selectedRecipientIds.length,
      audienceMode: state.manualRecipients ? 'manual' : 'all',
      mode: state.mode ?? BroadcastMessageMode.Copy,
    });
  }

  private getSettingsKeyboard(ctx: IStepCtx, state: TelegramBroadcastState) {
    return this.keyboardFactory.getBroadcastSettings(ctx, {
      manualMode: state.manualRecipients,
      onlyAuthorized: !!state.filter.onlyAuthorized,
      groupName: state.filter.groupName,
      feedbackButton: state.feedbackButton,
      feedbackResponseText: state.feedbackButton?.responseText,
      feedbackAfterClickText: state.feedbackButton?.afterClickText,
    });
  }

  private getConfirmKeyboard(ctx: IStepCtx, state: TelegramBroadcastState) {
    return this.keyboardFactory.getBroadcastConfirm(ctx, state.mode);
  }

  private async backToSettings(ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.sourceMessage = undefined;
    await this.refreshRecipientsCount(state);
    ctx.wizard.selectStep(1);
    await ctx.replyWithHTML(
      this.renderSettings(ctx, state),
      this.getSettingsKeyboard(ctx, state),
    );
  }

  private async createCampaignOrReplyActive(
    ctx: IStepCtx,
    state: TelegramBroadcastState,
  ) {
    try {
      return await this.broadcastService.createAndQueueCampaign({
        social: SocialType.Telegram,
        mode: state.mode,
        sourceMessage: state.sourceMessage!,
        audienceFilter: state.filter,
        recipientUserSocialIds: state.manualRecipients
          ? state.selectedRecipientIds
          : undefined,
        feedbackButton: state.feedbackButton,
        createdBySocialId: ctx.from?.id,
      });
    } catch (err) {
      const [campaign, status] = await Promise.all([
        this.broadcastService.getActiveCampaign(SocialType.Telegram),
        this.broadcastService.getQueueStatus(SocialType.Telegram),
      ]);
      if (!campaign && !status.hasPending) throw err;

      await ctx.replyWithHTML(
        [
          ctx.i18n.t(LocalePhrase.Page_Broadcast_AlreadyActive, { campaign }),
          '',
          ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
        ].join('\n'),
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
      return null;
    }
  }

  private async renderRecipientsSelector(ctx: IStepCtx) {
    const state = ctx.scene.state;
    const page = await this.broadcastService.getRecipientsPage({
      social: SocialType.Telegram,
      filter: state.filter,
      page: state.recipientsPage,
      limit: 8,
    });
    const selected = new Set(state.selectedRecipientIds);
    const keyboard = this.keyboardFactory.getPagination({
      name: 'broadcast-recipients',
      currentPage: page.currentPage,
      totalPages: page.totalPages,
      items: page.items.map((recipient) => ({
        title: `${selected.has(recipient.id) ? '✅' : '⬜'} ${this.renderRecipientTitle(recipient)}`,
        payload: String(recipient.id),
      })),
      actionPrefix: 'broadcast:wizard:recipient:',
      additionalButtons: [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          'broadcast:wizard:settings',
        ),
      ],
      columnizer: false,
      sortByLength: false,
    });

    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_SelectRecipients, {
        selectedCount: state.selectedRecipientIds.length,
        currentPage: page.currentPage,
        totalPages: page.totalPages,
      }),
      { parse_mode: 'HTML', ...keyboard },
    );
  }

  private async renderFilters(ctx: IStepCtx, answerCallback = true) {
    const state = ctx.scene.state;
    const preview = await this.broadcastService.getGroupsPreview(
      SocialType.Telegram,
      state.filter,
    );
    state.recipientsCount = this.getEffectiveRecipientsCount(
      state,
      preview.selectedRecipientsCount,
    );
    const message = ctx.i18n.t(LocalePhrase.Page_Broadcast_Filters, {
      filter: state.filter,
      recipientsCount: state.recipientsCount,
      groupsCount: state.filter.groupNames?.length || 0,
      lastInteractionAfter: state.filter.lastInteractionAfter,
      excludeCampaignIds: state.filter.excludeCampaignIds || [],
    });
    const keyboard = this.keyboardFactory.getBroadcastFilters(ctx, {
      hasGroups: !!state.filter.groupNames?.length,
      onlyAuthorized: !!state.filter.onlyAuthorized,
      hasActivityFilter: !!state.filter.lastInteractionAfter,
      hasExcludedCampaigns: !!state.filter.excludeCampaignIds?.length,
    });

    if (ctx.callbackQuery) {
      if (answerCallback) await ctx.tryAnswerCbQuery();
      await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
      return;
    }

    await ctx.replyWithHTML(message, keyboard);
  }

  private async applyTextFilter(
    ctx: IStepCtx,
    awaitingFilter: NonNullable<TelegramBroadcastState['awaitingFilter']>,
    text: string,
  ) {
    const state = ctx.scene.state;
    if (awaitingFilter === 'groups') {
      const groupNames = this.scheduleService.parseGroupNames(text);
      if (!groupNames.length) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
            groupName: text,
          }),
        );
        return;
      }
      state.filter.groupNames = groupNames;
      state.filter.groupName = null;
    } else if (awaitingFilter === 'activity') {
      const date = this.parseFilterDate(text);
      if (!date) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterActivityText),
        );
        return;
      }
      state.filter.lastInteractionAfter = date.toISOString();
    } else {
      const campaignIds = this.parseCampaignIds(text);
      if (!campaignIds.length) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterExcludeCampaignsText),
        );
        return;
      }
      state.filter.excludeCampaignIds = campaignIds;
    }

    state.awaitingFilter = undefined;
    this.resetManualRecipients(state);
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

  private async renderInstitutes(ctx: IStepCtx, page = 1) {
    const result = await this.groupFilterService.getInstitutesPage({
      social: SocialType.Telegram,
      filter: ctx.scene.state.filter,
      page,
      limit: 8,
    });
    const keyboard = this.keyboardFactory.getPagination({
      name: 'broadcast-filter-institutes',
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      items: result.items.map((institute, index) => ({
        title: `${institute.instituteName} — ${institute.recipientsCount}`,
        payload: `${result.currentPage}:${index}`,
      })),
      actionPrefix: 'broadcast:wizard:filter:institute:',
      additionalButtons: [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          'broadcast:wizard:filter:groups',
        ),
      ],
      columnizer: false,
      sortByLength: false,
    });

    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterInstitutes, {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      }),
      { parse_mode: 'HTML', ...keyboard },
    );
  }

  private async getInstituteGroupsPage(
    ctx: IStepCtx,
    institutesPage: number,
    instituteIndex: number,
    groupsPage: number,
  ) {
    const institutes = await this.groupFilterService.getInstitutesPage({
      social: SocialType.Telegram,
      filter: ctx.scene.state.filter,
      page: institutesPage,
      limit: 8,
    });
    const institute = institutes.items[instituteIndex];
    if (!institute) return { ...institutes, institute: undefined, items: [] };

    return await this.groupFilterService.getGroupsPage({
      social: SocialType.Telegram,
      filter: ctx.scene.state.filter,
      instituteName: institute.instituteName,
      page: groupsPage,
      limit: 8,
    });
  }

  private async renderInstituteGroups(
    ctx: IStepCtx,
    institutesPage: number,
    instituteIndex: number,
    groupsPage: number,
  ) {
    ctx.scene.state.activeGroupFilter = {
      institutesPage,
      instituteIndex,
    };
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
    const keyboard = this.keyboardFactory.getPagination({
      name: 'broadcast-filter-groups',
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      items: result.items.map((group, index) => ({
        title: `${selected.has(group.groupName) ? '✅' : '⬜'} ${group.groupName} — ${group.recipientsCount}`,
        payload: `${institutesPage}:${instituteIndex}:${result.currentPage}:${index}`,
      })),
      actionPrefix: 'broadcast:wizard:filter:group:',
      additionalButtons: [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterInstituteToggle, {
            selected: allSelected,
          }),
          `broadcast:wizard:filter:institute:toggle:${institutesPage}:${instituteIndex}:${result.currentPage}`,
        ),
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          `broadcast:wizard:filter:institutes:${institutesPage}`,
        ),
      ],
      columnizer: false,
      sortByLength: false,
    });

    await ctx.tryAnswerCbQuery();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_FilterGroups, {
        instituteName: result.institute.instituteName,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      }),
      { parse_mode: 'HTML', ...keyboard },
    );
  }

  private toggleGroups(state: TelegramBroadcastState, groupNames: string[]) {
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
    const chunks = this.splitText(groupNames.join(', '), 3500);
    for (const chunk of chunks) {
      await ctx.replyWithHTML(
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

  private renderReady(ctx: IStepCtx, state: TelegramBroadcastState) {
    return ctx.i18n.t(LocalePhrase.Page_Broadcast_Ready, {
      recipientsCount: state.recipientsCount ?? 0,
      selectedCount: state.selectedRecipientIds.length,
      mode: state.mode,
    });
  }

  private async refreshRecipientsCount(state: TelegramBroadcastState) {
    const count = await this.broadcastService.countRecipients(
      SocialType.Telegram,
      state.filter,
    );
    state.recipientsCount = this.getEffectiveRecipientsCount(state, count);
  }

  /** Ручный список не должен обходить обновлённые фильтры аудитории. */
  private resetManualRecipients(state: TelegramBroadcastState) {
    state.selectedRecipientIds = [];
    state.manualRecipients = false;
    state.recipientsPage = 1;
  }

  private getEffectiveRecipientsCount(
    state: TelegramBroadcastState,
    filteredCount: number,
  ) {
    return state.manualRecipients
      ? state.selectedRecipientIds.length
      : filteredCount;
  }

  private async applyFeedbackText(
    ctx: IStepCtx,
    target: NonNullable<TelegramBroadcastState['awaitingFeedbackText']>,
    text: string,
  ) {
    const value = text.trim();
    const maxLength = target === 'response' ? 200 : 40;
    if (!value || value.length > maxLength) {
      await ctx.replyWithHTML(
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
        ctx.scene.state.feedbackButton.afterClickText = value;
      }
    }
    ctx.scene.state.awaitingFeedbackText = undefined;
    await this.refreshRecipientsCount(ctx.scene.state);
    await ctx.replyWithHTML(
      this.renderSettings(ctx, ctx.scene.state),
      this.getSettingsKeyboard(ctx, ctx.scene.state),
    );
  }

  private renderRecipientTitle(recipient: {
    id: number;
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
      .slice(0, 50);
  }
}
