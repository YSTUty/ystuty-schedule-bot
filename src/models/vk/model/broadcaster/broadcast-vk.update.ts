import { UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Next, On, Update } from 'nestjs-vk';

import { NextMiddleware } from 'middleware-io';

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
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

  // TODO(broadcast): move command text to i18n when broadcast phrases are added.
  @Hears(['/broadcast', 'Рассылки'])
  async onBroadcast(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM) {
      await ctx.send('VK broadcast scene is available only in DM');
      return;
    }

    await ctx.scene.enter(VK_BROADCAST_SCENE);
  }

  @Hears('/broadcast_status')
  async onBroadcastStatus(@Ctx() ctx: IMessageContext) {
    const status = await this.broadcastService.getQueueStatus(
      SocialType.Vkontakte,
    );
    await ctx.send(this.renderQueueStatus(status), {
      ...(status.hasPending && {
        keyboard: this.keyboardFactory
          .getBroadcastQueueControls(status.paused)
          .inline(),
      }),
    });
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
      | 'create'
      | undefined;
    if (!action || action === 'create') return next();

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
  }

  private renderQueueStatus(
    status: Awaited<ReturnType<BroadcastService['getQueueStatus']>>,
  ) {
    return [
      'Broadcast queue',
      `Active: ${status.active}`,
      `Waiting: ${status.waiting}`,
      `Delayed: ${status.delayed}`,
      `Completed: ${status.completed}`,
      `Failed: ${status.failed}`,
      `Paused: ${status.paused}`,
    ].join('\n');
  }
}
