import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { FeedbackService } from '../../feedback/feedback.service';
import {
  FeedbackCategory,
  FeedbackSourceMessage,
} from '../../feedback/feedback.types';
import { VkFeedbackDeliveryService } from '../vk-feedback-delivery.service';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { VK_REACTION_IDS, VkReactionEmoji } from '../vk.constants';
import { VkService } from '../vk.service';

export const VK_FEEDBACK_SCENE = 'VK_FEEDBACK_SCENE';
const MAX_FEEDBACK_MESSAGES = 10;
const MAX_FEEDBACK_MEDIA = 10;
const categories = new Set(Object.values(FeedbackCategory));

type FeedbackSceneState = {
  category?: FeedbackCategory;
  messages: FeedbackSourceMessage[];
  mediaCount: number;
  /** Возвращает стартовый экран, если отмена перехвачена общим middleware. */
  cancelToStartScreen?: boolean;
  menuMessageId?: number;
};

@Scene(VK_FEEDBACK_SCENE)
@UseFilters(VkExceptionFilter)
export class VkFeedbackScene {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly feedbackDeliveryService: VkFeedbackDeliveryService,
    private readonly vkService: VkService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @AddStep()
  async step(@Ctx() ctx: IStepContext<FeedbackSceneState>) {
    const state = ctx.scene.state;
    if (ctx.scene.step.firstTime) {
      state.messages = [];
      state.mediaCount = 0;
      state.cancelToStartScreen = true;
      const menuMessageId = await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Feedback_SelectCategory),
        { keyboard: this.keyboardFactory.getFeedbackCategories(ctx) },
      );
      if (typeof menuMessageId === 'number') {
        state.menuMessageId = menuMessageId;
      }
      return;
    }

    const action =
      'eventPayload' in ctx
        ? (ctx.eventPayload.feedbackAction as string | undefined)
        : undefined;
    if (action === 'category') {
      await this.selectCategory(ctx, String(ctx.eventPayload.category));
      return;
    }
    if (action === 'submit') {
      await this.submit(ctx);
      return;
    }
    if (action === 'cancel') {
      if (ctx.isMessageEventContext()) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(LocalePhrase.Common_Canceled),
        });
        await ctx
          .deleteMessage({ delete_for_all: true })
          .catch(() => undefined);
      }
      await ctx.scene.leave();
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_WelcomeFeatures), {
        keyboard: this.keyboardFactory.getWelcomeFeatures(ctx).inline(),
      });
      return;
    }
    if (ctx.isMessageEventContext()) return;

    const input = this.getSourceMessage(ctx);
    if (!input) return;

    if (state.messages.length >= MAX_FEEDBACK_MESSAGES) {
      await this.reactToMessage(ctx, '👎');
      return;
    }

    const mediaCount = input.attachments?.length || 0;
    if (state.mediaCount + mediaCount > MAX_FEEDBACK_MEDIA) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Feedback_MediaLimit));
      return;
    }

    const isPrimary = state.messages.length === 0;
    state.messages.push({
      ...input,
      ...(isPrimary ? { isPrimary: true } : {}),
    });
    state.mediaCount += mediaCount;
    if (isPrimary) {
      await this.reactToMessage(ctx, '🏆');
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Feedback_FirstMessage), {
        keyboard: this.keyboardFactory.getFeedbackCollector(ctx),
      });
    } else if (input.text) {
      await this.reactToMessage(ctx, '👌');
    }

    if (state.messages.length === MAX_FEEDBACK_MESSAGES) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Feedback_MessageLimitReached),
        { keyboard: this.keyboardFactory.getFeedbackCollector(ctx) },
      );
    }
  }

  private async selectCategory(
    ctx: IStepContext<FeedbackSceneState>,
    value: string,
  ) {
    if (!categories.has(value as FeedbackCategory)) return;
    ctx.scene.state.category = value as FeedbackCategory;
    if (ctx.isMessageEventContext()) {
      await ctx.answer({ type: 'show_snackbar', text: 'Категория выбрана' });
      await ctx.editMessage({
        message: ctx.i18n.t(LocalePhrase.Page_Feedback_EnterContent),
        keyboard: this.keyboardFactory.getFeedbackCollector(ctx),
      });
      return;
    }
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Feedback_EnterContent), {
      keyboard: this.keyboardFactory.getFeedbackCollector(ctx),
    });
  }

  private async submit(@Ctx() ctx: IStepContext<FeedbackSceneState>) {
    const state = ctx.scene.state;
    if (!state.messages.length || !state.category) {
      if (ctx.isMessageEventContext()) {
        await ctx.answer({
          type: 'show_snackbar',
          text: ctx.i18n.t(LocalePhrase.Page_Feedback_ContentRequired),
        });
      }
      return;
    }
    if (ctx.isMessageEventContext()) {
      await ctx.answer({ type: 'show_snackbar', text: 'Отправляю отзыв…' });
    }

    const feedback = await this.feedbackService.create({
      userSocialId: ctx.state.userSocial.id,
      social: ctx.state.userSocial.social,
      category: state.category,
      sourcePeerId: String(ctx.peerId),
      content: { messages: state.messages },
    });
    if (!feedback) {
      await ctx.scene.leave();
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Feedback_Cooldown), {
        keyboard: this.keyboardFactory
          .getStart(ctx)
          .inline(this.keyboardFactory.needInline(ctx)),
      });
      return;
    }

    const delivered = await this.feedbackDeliveryService.deliver(feedback);
    await ctx.scene.leave();
    await ctx.send(
      ctx.i18n.t(
        delivered
          ? LocalePhrase.Page_Feedback_Submitted
          : LocalePhrase.Page_Feedback_DeliveryPending,
        { feedbackId: feedback.id },
      ),
      {
        keyboard: this.keyboardFactory
          .getStart(ctx)
          .inline(this.keyboardFactory.needInline(ctx)),
      },
    );
  }

  private getSourceMessage(ctx: IStepContext<FeedbackSceneState>) {
    if (!ctx.isMessageContext()) return null;

    const attachments = ctx.attachments.map((attachment) => ({
      type: attachment.type,
      payload: attachment.toJSON(),
    }));
    const text = ctx.text?.trim();
    if (!text && !attachments.length) return null;

    return {
      messageId: ctx.id,
      ...(ctx.conversationMessageId
        ? { conversationMessageId: ctx.conversationMessageId }
        : {}),
      ...(text ? { text } : {}),
      ...(attachments.length ? { attachments } : {}),
    };
  }

  /** Отмечает сообщение реакцией, но не прерывает сценарий при ошибке VK API. */
  private async reactToMessage(
    ctx: IStepContext<FeedbackSceneState>,
    reaction: VkReactionEmoji,
  ) {
    if (!ctx.conversationMessageId) return;
    await this.vkService.bot.api.messages
      .sendReaction({
        peer_id: ctx.peerId,
        cmid: ctx.conversationMessageId,
        reaction_id: VK_REACTION_IDS[reaction],
      })
      .catch(() => undefined);
  }
}
