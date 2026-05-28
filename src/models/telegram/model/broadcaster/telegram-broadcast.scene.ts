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
  BroadcastMessageMode,
  BroadcastSourceMessage,
} from '../../../broadcast/broadcast.types';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

type TelegramBroadcastState = {
  filter: BroadcastAudienceFilter;
  sourceMessage?: BroadcastSourceMessage;
  recipientsCount?: number;
  selectedRecipientIds: number[];
  recipientsPage: number;
  manualRecipients: boolean;
  mode: BroadcastMessageMode.Copy | BroadcastMessageMode.Forward;
};

type IStepCtx = IStepContext<TelegramBroadcastState>;

@Wizard(TELEGRAM_BROADCAST_SCENE)
export class TelegramBroadcastScene extends BaseScene {
  constructor(
    private readonly broadcastService: BroadcastService,
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
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_SendSample),
      Markup.keyboard([['/cancel']]).resize(),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  @Hears(/.+/)
  async onStep2Hint(@Ctx() ctx: IStepCtx) {
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_SettingsReadyHint),
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

    await ctx.tryAnswerCbQuery(`Режим: ${state.mode}`);
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
    return this.keyboardFactory.getBroadcastSettings(
      ctx,
      state.manualRecipients,
    );
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
    const keyboard = this.keyboardFactory.getPagination(
      'broadcast-recipients',
      page.currentPage,
      page.totalPages,
      page.items.map((recipient) => ({
        title: `${selected.has(recipient.id) ? '✅' : '⬜'} ${this.renderRecipientTitle(recipient)}`,
        payload: String(recipient.id),
      })),
      'broadcast:wizard:recipient:',
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          'broadcast:wizard:settings',
        ),
      ],
      false,
      false,
    );

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

  private getEffectiveRecipientsCount(
    state: TelegramBroadcastState,
    filteredCount: number,
  ) {
    return state.manualRecipients
      ? state.selectedRecipientIds.length
      : filteredCount;
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
