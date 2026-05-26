import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { SocialType, VkExceptionFilter } from '@my-common';
import { IStepContext } from '@my-interfaces/vk';

import { VK_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import {
  BroadcastAudienceFilter,
  BroadcastMessageMode,
  BroadcastSourceMessage,
} from '../../../broadcast/broadcast.types';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

type VkBroadcastState = {
  filter: BroadcastAudienceFilter;
  sourceMessage?: BroadcastSourceMessage;
  recipientsCount?: number;
};

@Scene(VK_BROADCAST_SCENE)
@UseFilters(VkExceptionFilter)
export class VkBroadcastScene {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @AddStep()
  async step1(@Ctx() ctx: IStepContext<VkBroadcastState>) {
    if (ctx.scene.step.firstTime) {
      ctx.scene.state.filter = {
        hasDM: true,
        isBlockedBot: false,
      };
      ctx.scene.state.recipientsCount =
        await this.broadcastService.countRecipients(
          SocialType.Vkontakte,
          ctx.scene.state.filter,
        );

      await ctx.send(
        [
          'Настройки VK-рассылки',
          `Получателей сейчас: ${ctx.scene.state.recipientsCount}`,
          '',
          'Отправь текст сообщения следующим сообщением.',
          'Для отмены: /cancel',
        ].join('\n'),
        { keyboard: this.keyboardFactory.getCancel(ctx) },
      );
    }

    return ctx.scene.step.next({ silent: true });
  }

  @AddStep()
  async step2(@Ctx() ctx: IStepContext<VkBroadcastState>) {
    if (!ctx.text || ctx.text === '/cancel') {
      await ctx.send('VK-рассылка отменена');
      return ctx.scene.leave();
    }

    ctx.scene.state.sourceMessage = { text: ctx.text };
    await ctx.send(
      [
        'VK-рассылка готова к запуску.',
        `Получателей: ${ctx.scene.state.recipientsCount ?? 0}`,
        '',
        'Отправь /send для запуска или /cancel для отмены.',
      ].join('\n'),
    );

    return ctx.scene.step.next();
  }

  @AddStep()
  async step3(@Ctx() ctx: IStepContext<VkBroadcastState>) {
    if (ctx.text === '/cancel') {
      await ctx.send('VK-рассылка отменена');
      return ctx.scene.leave();
    }

    if (ctx.text !== '/send') {
      await ctx.send('Для запуска отправь /send, для отмены - /cancel.');
      return;
    }

    const campaign = await this.broadcastService.createAndQueueCampaign({
      social: SocialType.Vkontakte,
      mode: BroadcastMessageMode.Text,
      sourceMessage: ctx.scene.state.sourceMessage!,
      audienceFilter: ctx.scene.state.filter,
      createdBySocialId: ctx.senderId,
    });

    await ctx.send(
      `VK-рассылка #${campaign.id} поставлена в очередь. Получателей: ${campaign.totalCount}`,
      { keyboard: this.keyboardFactory.getStart(ctx) },
    );
    return ctx.scene.leave();
  }
}
