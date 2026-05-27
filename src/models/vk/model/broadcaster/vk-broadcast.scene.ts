import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { AttachmentType } from 'vk-io';

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
  confirmMessage?: { chatId: number; messageId: number };
};

type IStepCtx = IStepContext<VkBroadcastState>;

@Scene(VK_BROADCAST_SCENE)
@UseFilters(VkExceptionFilter)
export class VkBroadcastScene {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @AddStep()
  async step1(@Ctx() ctx: IStepCtx) {
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
          'Отправь текст, стикер или сообщение с вложением следующим сообщением.',
          'Для отмены: /cancel',
        ].join('\n'),
        { keyboard: this.keyboardFactory.getCancel(ctx) },
      );
    }

    return ctx.scene.step.next({ silent: true });
  }

  @AddStep()
  async step2(@Ctx() ctx: IStepCtx) {
    if (ctx.text === '/cancel') {
      await ctx.send('VK-рассылка отменена');
      return ctx.scene.leave();
    }

    const sourceMessage = this.getSourceMessage(ctx);
    if (!sourceMessage) {
      await ctx.send(
        'Не удалось определить сообщение для рассылки. Отправь текст, стикер или вложение.',
      );
      return;
    }

    ctx.scene.state.sourceMessage = sourceMessage;
    const reportMessage = await ctx.send(
      [
        'VK-рассылка готова к запуску.',
        `Получателей: ${ctx.scene.state.recipientsCount ?? 0}`,
        '',
        'Отправь /send или нажми кнопку для создания очереди. Очередь будет создана на паузе.',
      ].join('\n'),
      { keyboard: this.keyboardFactory.getBroadcastConfirm().inline() },
    );
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
      await ctx.send('VK-рассылка отменена');
      return ctx.scene.leave();
    }

    const isCreateAction =
      'eventPayload' in ctx && ctx.eventPayload?.broadcastAction === 'create';
    if (ctx.text !== '/send' && !isCreateAction) {
      await ctx.send('Для запуска отправь /send, для отмены - /cancel.');
      return;
    }

    if (isCreateAction && 'answer' in ctx) {
      await ctx.answer({ type: 'show_snackbar', text: 'Создание очереди' });
    }

    const campaign = await this.broadcastService.createAndQueueCampaign({
      social: SocialType.Vkontakte,
      mode: BroadcastMessageMode.Text,
      sourceMessage: {
        ...ctx.scene.state.sourceMessage!,
      },
      audienceFilter: ctx.scene.state.filter,
      createdBySocialId: ctx.senderId,
    });

    if (ctx.scene.state.confirmMessage) {
      await ctx.api.messages.edit({
        peer_id: ctx.scene.state.confirmMessage.chatId,
        conversation_message_id: ctx.scene.state.confirmMessage.messageId,
        message: 'VK-рассылка поставлена в очередь.',
        keyboard: this.keyboardFactory.getClose(ctx).inline(),
      });
    }

    const queuedMessage = await ctx.send(
      `VK-рассылка #${campaign.id} поставлена в очередь. Получателей: ${campaign.totalCount}`,
      {
        keyboard: this.keyboardFactory.getBroadcastQueueControls(true).inline(),
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
    return ctx.scene.leave();
  }

  private getSourceMessage(ctx: IStepCtx): BroadcastSourceMessage | null {
    if (ctx.hasText) {
      return { text: ctx.text };
    }

    if (ctx.hasAttachments(AttachmentType.STICKER)) {
      const stickers = ctx.getAttachments(AttachmentType.STICKER);
      console.log(stickers);
      return { stickerId: stickers[0].id };
    }

    // if (ctx.hasAttachments(AttachmentType.WALL)) {
    //   const walls = ctx.getAttachments(AttachmentType.WALL);
    //   console.log(walls);
    //   return { wallId: walls[0].id };
    // }

    // const attachments = 'attachments' in ctx ? ctx.attachments : [];
    // const attachment = attachments.map((e) => e.toJSON());
    // console.log(attachments);
    // if (attachment) {
    //   return { text: '', attachment };
    // }

    return null;
  }
}
