import { Module } from '@nestjs/common';

import { BroadcastVkUpdate } from './broadcast-vk.update';
import { VkBroadcastScene } from './vk-broadcast.scene';
import { VkBroadcastTransport } from './vk-broadcast.transport';

@Module({
  providers: [BroadcastVkUpdate, VkBroadcastScene, VkBroadcastTransport],
})
export class VkBroadcasterModule {}
