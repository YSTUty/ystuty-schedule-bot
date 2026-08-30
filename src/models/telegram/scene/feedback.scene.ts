import { Action, Ctx, On, Wizard, WizardStep } from '@xtcry/nestjs-telegraf';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/telegram';

import { FeedbackService } from '../../feedback/feedback.service';
import {
  FeedbackCategory,
  FeedbackSourceMessage,
} from '../../feedback/feedback.types';
import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { TelegramService } from '../telegram.service';

import { BaseScene } from './base.scene';

export const TELEGRAM_FEEDBACK_SCENE = 'TELEGRAM_FEEDBACK_SCENE';
const MAX_FEEDBACK_MESSAGES = 10;
const MAX_FEEDBACK_MEDIA = 10;
const categories = new Set(Object.values(FeedbackCategory));

type FeedbackSceneState = {
  category?: FeedbackCategory;
  messages: FeedbackSourceMessage[];
  mediaCount: number;
  menuMessageId?: number;
};

@Wizard(TELEGRAM_FEEDBACK_SCENE)
export class TelegramFeedbackScene extends BaseScene {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly telegramService: TelegramService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  @WizardStep(1)
  @On('message')
  async onEnter(@Ctx() ctx: IStepContext<FeedbackSceneState>) {
    ctx.scene.state.messages = [];
    ctx.scene.state.mediaCount = 0;
    const menuMessage = await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Feedback_SelectCategory),
      this.keyboardFactory.getFeedbackCategories(ctx),
    );
    ctx.scene.state.menuMessageId = menuMessage.message_id;
  }

  @WizardStep(1)
  @Action(/feedback:category:(?<category>[a-z_]+)/)
  async chooseCategory(@Ctx() ctx: IStepContext<FeedbackSceneState>) {
    const category = ctx.match?.groups?.category;
    if (!category || !categories.has(category as FeedbackCategory)) {
      await ctx.tryAnswerCbQuery();
      return;
    }

    ctx.scene.state.category = category as FeedbackCategory;
    ctx.wizard.next();
    await ctx.editMessageText(
      ctx.i18n.t(LocalePhrase.Page_Feedback_EnterContent),
      {
        ...this.keyboardFactory.getFeedbackCollector(ctx),
        parse_mode: 'HTML',
      },
    );
    await ctx.tryAnswerCbQuery();
  }

  @WizardStep(2)
  @On('message')
  async collectMessage(@Ctx() ctx: IStepContext<FeedbackSceneState>) {
    const input = this.getSourceMessage(ctx);
    if (!input) return;

    const state = ctx.scene.state;
    if (state.messages.length >= MAX_FEEDBACK_MESSAGES) {
      await ctx.react('💔').catch(() => undefined);
      return;
    }

    const mediaCount = input.attachments?.length || 0;
    if (state.mediaCount + mediaCount > MAX_FEEDBACK_MEDIA) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Feedback_MediaLimit),
      );
      return;
    }

    const isPrimary = state.messages.length === 0;
    state.messages.push({
      ...input,
      ...(isPrimary ? { isPrimary: true } : {}),
    });
    state.mediaCount += mediaCount;
    if (isPrimary) {
      // Реакция служит пользователю визуальной меткой основного сообщения.
      await ctx.react('🏆').catch(() => undefined);
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Feedback_FirstMessage),
        this.keyboardFactory.getFeedbackCollector(ctx),
      );
    } else if (input.text) {
      await ctx.react('🫡').catch(() => undefined);
    }

    if (state.messages.length === MAX_FEEDBACK_MESSAGES) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Feedback_MessageLimitReached),
        this.keyboardFactory.getFeedbackCollector(ctx),
      );
    }
  }

  @WizardStep(2)
  @Action('feedback:submit')
  async submit(@Ctx() ctx: IStepContext<FeedbackSceneState>) {
    await ctx.tryAnswerCbQuery();
    const state = ctx.scene.state;
    if (!state.messages.length || !state.category || !ctx.chat) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Feedback_ContentRequired),
      );
      return;
    }

    const feedback = await this.feedbackService.create({
      userSocialId: ctx.userSocial.id,
      social: ctx.userSocial.social,
      category: state.category,
      sourcePeerId: String(ctx.chat.id),
      content: { messages: state.messages },
    });
    if (!feedback) {
      await this.leaveScene(ctx);
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Feedback_Cooldown),
        this.keyboardFactory.getStart(ctx),
      );
      return;
    }

    const delivered = await this.forwardToAdmins(ctx, feedback.id, state);
    await this.leaveScene(ctx);
    await ctx.replyWithHTML(
      ctx.i18n.t(
        delivered
          ? LocalePhrase.Page_Feedback_Submitted
          : LocalePhrase.Page_Feedback_DeliveryPending,
        { feedbackId: feedback.id },
      ),
      this.keyboardFactory.getStart(ctx),
    );
  }

  async onСancel(ctx: IStepContext<FeedbackSceneState>) {
    if (ctx.chat && ctx.scene.state.menuMessageId) {
      await this.telegramService.bot.telegram
        .deleteMessage(ctx.chat.id, ctx.scene.state.menuMessageId)
        .catch(() => undefined);
    }
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_WelcomeFeatures),
      this.keyboardFactory.getWelcomeFeatures(ctx),
    );
  }

  private getSourceMessage(ctx: IStepContext<FeedbackSceneState>) {
    const message = ctx.message;
    if (!message) return null;

    const attachmentType = [
      'photo',
      'video',
      'animation',
      'audio',
      'document',
      'voice',
      'video_note',
      'sticker',
      'location',
      'contact',
      'poll',
    ].find((type) => type in message);
    const text =
      ('text' in message && message.text) ||
      ('caption' in message && message.caption) ||
      undefined;
    if (!text && !attachmentType) return null;

    const attachment = attachmentType
      ? (message as unknown as Record<string, unknown>)[attachmentType]
      : undefined;
    return {
      messageId: message.message_id,
      ...(text ? { text } : {}),
      ...(attachmentType && attachment
        ? {
            attachments: [
              {
                type: attachmentType,
                payload: JSON.parse(JSON.stringify(attachment)),
              },
            ],
          }
        : {}),
    };
  }

  private async forwardToAdmins(
    ctx: IStepContext<FeedbackSceneState>,
    feedbackId: number,
    state: FeedbackSceneState,
  ) {
    const messageIds = state.messages.map((message) => message.messageId);
    const errors: string[] = [];
    let sentCount = 0;
    if (!xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.length) {
      errors.push('No Telegram feedback administrators configured');
    }
    for (const adminId of xEnv.SOCIAL_TELEGRAM_ADMIN_IDS) {
      try {
        await this.telegramService.bot.telegram.sendMessage(
          adminId,
          `<b>Обратная связь №${feedbackId}</b>\nКатегория: ${this.getCategoryTitle(ctx, state.category!)}`,
          { parse_mode: 'HTML' },
        );
        await this.telegramService.bot.telegram.forwardMessages(
          adminId,
          ctx.chat!.id,
          messageIds,
        );
        sentCount++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    const status = await this.feedbackService.setDeliveryResult(feedbackId, {
      sentCount,
      ...(errors.length ? { error: errors.join('; ').slice(0, 2000) } : {}),
    });
    return status === 'sent';
  }

  private getCategoryTitle(
    ctx: IStepContext<FeedbackSceneState>,
    category: FeedbackCategory,
  ) {
    const phrase = {
      [FeedbackCategory.Schedule]:
        LocalePhrase.Button_Feedback_CategorySchedule,
      [FeedbackCategory.Bot]: LocalePhrase.Button_Feedback_CategoryBot,
      [FeedbackCategory.Suggestion]:
        LocalePhrase.Button_Feedback_CategorySuggestion,
      [FeedbackCategory.Other]: LocalePhrase.Button_Feedback_CategoryOther,
    }[category];
    return ctx.i18n.t(phrase);
  }
}
