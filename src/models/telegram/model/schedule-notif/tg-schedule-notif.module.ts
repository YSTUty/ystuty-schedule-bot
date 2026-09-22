import { Module } from '@nestjs/common';

import { TgGroupPicker } from '../group-selection/tg-group-picker';

import { TgScheduleNotifGroupScene } from './tg-schedule-notif-group.scene';
import { TgScheduleNotifKeyboardFactory } from './tg-schedule-notif-keyboard.factory';
import { TgScheduleNotifTeacherScene } from './tg-schedule-notif-teacher.scene';
import { TgScheduleNotifTransport } from './tg-schedule-notif.transport';
import { TgScheduleNotifUpdate } from './tg-schedule-notif.update';

@Module({
  providers: [
    TgScheduleNotifKeyboardFactory,
    TgScheduleNotifTransport,
    TgScheduleNotifUpdate,
    TgScheduleNotifGroupScene,
    TgScheduleNotifTeacherScene,
    TgGroupPicker,
  ],
})
export class TgScheduleNotifModule {}
