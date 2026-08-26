import { Module } from '@nestjs/common';

import { BroadcastVkFeedbackUpdate } from './broadcast-vk-feedback.update';
import { BroadcastVkUpdate } from './broadcast-vk.update';
import { VkBroadcastScene } from './vk-broadcast.scene';
import { VkBroadcastTransport } from './vk-broadcast.transport';

@Module({
  providers: [
    BroadcastVkUpdate,
    BroadcastVkFeedbackUpdate,
    VkBroadcastScene,
    VkBroadcastTransport,
  ],
})
export class VkBroadcasterModule {}
