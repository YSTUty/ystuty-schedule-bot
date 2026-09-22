import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import { FeedbackCategory } from '../../feedback/feedback.types';

/** Клавиатуры, принадлежащие только сценарию пользовательского отзыва. */
@Injectable()
export class VkFeedbackKeyboardFactory {
  /** Inline-клавиатура категории пользовательского отзыва. */
  public getFeedbackCategories(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategorySchedule),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Schedule,
          },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategoryBot),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Bot,
          },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategorySuggestion),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Suggestion,
          },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategoryOther),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Other,
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { feedbackAction: 'cancel' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]).inline();
  }

  /** Inline-клавиатура для завершения сбора текста и вложений. */
  public getFeedbackCollector(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_Submit),
          payload: { feedbackAction: 'submit' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { feedbackAction: 'cancel' },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
    ]).inline();
  }
}
