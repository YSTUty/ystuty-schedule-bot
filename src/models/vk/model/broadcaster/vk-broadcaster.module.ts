import { Module } from '@nestjs/common';

import { BroadcastVkFeedbackUpdate } from './broadcast-vk-feedback.update';
import { BroadcastVkRecipientActionUpdate } from './broadcast-vk-recipient-action.update';
import { BroadcastVkUnsubscribeUpdate } from './broadcast-vk-unsubscribe.update';
import { BroadcastVkUpdate } from './broadcast-vk.update';
import { VkBroadcastKeyboardFactory } from './vk-broadcast-keyboard.factory';
import { VkBroadcastScene } from './vk-broadcast.scene';
import { VkBroadcastTransport } from './vk-broadcast.transport';

@Module({
  providers: [
    VkBroadcastKeyboardFactory,
    BroadcastVkUpdate,
    BroadcastVkFeedbackUpdate,
    BroadcastVkRecipientActionUpdate,
    BroadcastVkUnsubscribeUpdate,
    VkBroadcastScene,
    VkBroadcastTransport,
  ],
})
export class VkBroadcasterModule {}
