import { Module } from '@nestjs/common';

import { VkScheduleNotificationGroupScene } from './vk-schedule-notification-group.scene';
import { VkScheduleNotificationTransport } from './vk-schedule-notification.transport';
import { VkScheduleNotificationUpdate } from './vk-schedule-notification.update';

@Module({
  providers: [
    VkScheduleNotificationTransport,
    VkScheduleNotificationUpdate,
    VkScheduleNotificationGroupScene,
  ],
})
export class VkScheduleNotificationModule {}
