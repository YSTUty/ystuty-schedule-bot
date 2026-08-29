import { UseFilters } from '@nestjs/common';
import { Ctx, Hears, Update } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';

import { VK_FEEDBACK_SCENE } from '../scene/feedback.scene';

@Update()
@UseFilters(VkExceptionFilter)
export class VkFeedbackUpdate {
  @Hears('/feedback')
  @VkHearsLocale(LocalePhrase.Button_Feedback)
  async enterFeedback(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM) return;
    await ctx.scene.enter(VK_FEEDBACK_SCENE);
  }
}
