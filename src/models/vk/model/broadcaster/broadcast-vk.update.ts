import { UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Update } from 'nestjs-vk';

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { IMessageContext } from '@my-interfaces/vk';

import { VK_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';

@Update()
@UseFilters(VkExceptionFilter)
@UseGuards(new VkAdminGuard(true))
export class BroadcastVkUpdate {
  constructor(private readonly broadcastService: BroadcastService) {}

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
    const status = await this.broadcastService.getQueueStatus();
    await ctx.send(
      [
        'Broadcast queue',
        `Active: ${status.active}`,
        `Waiting: ${status.waiting}`,
        `Delayed: ${status.delayed}`,
        `Completed: ${status.completed}`,
        `Failed: ${status.failed}`,
      ].join('\n'),
    );
  }

  @Hears('/broadcast_terminate')
  async onBroadcastTerminate(@Ctx() ctx: IMessageContext) {
    await this.broadcastService.terminateActiveCampaigns();
    await ctx.send('Active broadcast queue terminated.');
  }
}
