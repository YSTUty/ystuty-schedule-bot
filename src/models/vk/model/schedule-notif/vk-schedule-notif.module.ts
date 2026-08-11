import { Module } from '@nestjs/common';

import { VkScheduleNotifGroupScene } from './vk-schedule-notif-group.scene';
import { VkScheduleNotifTransport } from './vk-schedule-notif.transport';
import { VkScheduleNotifUpdate } from './vk-schedule-notif.update';
import { VkGroupPicker } from '../vk-group-picker';

@Module({
  providers: [
    VkScheduleNotifTransport,
    VkScheduleNotifUpdate,
    VkScheduleNotifGroupScene,
    VkGroupPicker,
  ],
})
export class VkScheduleNotifModule {}
