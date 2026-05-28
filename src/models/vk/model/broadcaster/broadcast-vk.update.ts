import { UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Next, On, Update } from 'nestjs-vk';

import { NextMiddleware } from 'middleware-io';

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { VK_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

@Update()
@UseFilters(VkExceptionFilter)
@UseGuards(new VkAdminGuard(true))
export class BroadcastVkUpdate {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @Hears('/broadcast')
  @VkHearsLocale(LocalePhrase.Button_Broadcast)
  async onBroadcast(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Broadcast_PrivateOnly));
      return;
    }

    await ctx.scene.enter(VK_BROADCAST_SCENE);
  }

  @Hears('/broadcast_status')
  async onBroadcastStatus(@Ctx() ctx: IMessageContext) {
    const status = await this.broadcastService.getQueueStatus(
      SocialType.Vkontakte,
    );
    await ctx.send(
      ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      {
        ...(status.hasPending && {
          keyboard: this.keyboardFactory
            .getBroadcastQueueControls(ctx, status.paused)
            .inline(),
        }),
      },
    );
  }

  @Hears('/broadcast_terminate')
  async onBroadcastTerminate(@Ctx() ctx: IMessageContext) {
    await this.broadcastService.terminateActiveCampaigns(SocialType.Vkontakte);
    await ctx.send('Active broadcast queue terminated.');
  }

  @On('message_event')
  async onQueueAction(
    @Ctx() ctx: IMessageEventContext,
    @Next() next: NextMiddleware,
  ) {
    const action = ctx.eventPayload?.broadcastAction as
      | 'pause'
      | 'resume'
      | 'terminate'
      | undefined;
    if (!action || !['pause', 'resume', 'terminate'].includes(action)) {
      return next();
    }

    if (action === 'pause') {
      await this.broadcastService.pauseQueue(SocialType.Vkontakte);
      await ctx.answer({
        type: 'show_snackbar',
        text: 'Рассылка приостановлена',
      });
    }
    if (action === 'resume') {
      await this.broadcastService.resumeQueue(SocialType.Vkontakte);
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка продолжена' });
    }
    if (action === 'terminate') {
      await this.broadcastService.terminateActiveCampaigns(
        SocialType.Vkontakte,
      );
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка остановлена' });
    }

    const status = await this.broadcastService.getQueueStatus(
      SocialType.Vkontakte,
    );
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      conversation_message_id: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Broadcast_QueueStatus, { status }),
      ...(status.hasPending && action !== 'terminate'
        ? {
            keyboard: this.keyboardFactory
              .getBroadcastQueueControls(ctx, status.paused)
              .inline(),
          }
        : { keyboard: this.keyboardFactory.getClose(ctx).inline() }),
    });
  }
}
