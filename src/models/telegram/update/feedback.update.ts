import { UseFilters } from '@nestjs/common';
import { Command, Ctx, Update } from '@xtcry/nestjs-telegraf';

import { TelegrafExceptionFilter } from '@my-common';
import { AllowedChatTypes, TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/telegram';

import { TELEGRAM_FEEDBACK_SCENE } from '../scene/feedback.scene';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class TelegramFeedbackUpdate {
  @Command('feedback')
  @TgHearsLocale(LocalePhrase.Button_Feedback)
  @AllowedChatTypes('private')
  async enterFeedback(@Ctx() ctx: IMessageContext) {
    await ctx.scene.enter(TELEGRAM_FEEDBACK_SCENE);
  }
}
