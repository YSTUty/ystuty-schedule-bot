import { Module } from '@nestjs/common';

import { VkGroupPicker } from '../vk-group-picker';

import { VkScheduleNotifGroupScene } from './vk-schedule-notif-group.scene';
import { VkScheduleNotifTeacherScene } from './vk-schedule-notif-teacher.scene';
import { VkScheduleNotifTransport } from './vk-schedule-notif.transport';
import { VkScheduleNotifUpdate } from './vk-schedule-notif.update';

@Module({
  providers: [
    VkScheduleNotifTransport,
    VkScheduleNotifUpdate,
    VkScheduleNotifGroupScene,
    VkScheduleNotifTeacherScene,
    VkGroupPicker,
  ],
})
export class VkScheduleNotifModule {}
