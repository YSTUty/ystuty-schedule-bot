import { Module } from '@nestjs/common';

import { VkScheduleNotificationTransport } from './vk-schedule-notification.transport';
import { VkScheduleNotificationUpdate } from './vk-schedule-notification.update';

@Module({
  providers: [VkScheduleNotificationTransport, VkScheduleNotificationUpdate],
})
export class VkScheduleNotificationModule {}
