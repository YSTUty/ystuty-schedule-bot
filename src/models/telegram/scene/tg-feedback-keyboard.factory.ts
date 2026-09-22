import { Injectable } from '@nestjs/common';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { FeedbackCategory } from '../../feedback/feedback.types';
import {
  TelegramMarkup as Markup,
  TelegramButtons,
} from '../telegram-buttons.util';

/** Клавиатуры, принадлежащие только сценарию пользовательского отзыва. */
@Injectable()
export class TgFeedbackKeyboardFactory {
  /** Inline-клавиатура категории пользовательского отзыва. */
  public getFeedbackCategories(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Feedback_CategorySchedule),
          `feedback:category:${FeedbackCategory.Schedule}`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Feedback_CategoryBot),
          `feedback:category:${FeedbackCategory.Bot}`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Feedback_CategorySuggestion),
          `feedback:category:${FeedbackCategory.Suggestion}`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Feedback_CategoryOther),
          `feedback:category:${FeedbackCategory.Other}`,
        ),
      ],
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Cancel),
          LocalePhrase.Button_Cancel,
          { style: 'danger' },
        ),
      ],
    ]);
  }

  /** Постоянная кнопка завершения сбора текста и медиа. */
  public getFeedbackCollector(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Feedback_Submit),
          'feedback:submit',
          { style: 'success' },
        ),
      ],
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Cancel),
          LocalePhrase.Button_Cancel,
          { style: 'danger' },
        ),
      ],
    ]);
  }
}
