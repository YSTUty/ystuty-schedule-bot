import { Module } from '@nestjs/common';

import { TgGroupPicker } from '../tg-group-picker';

import { TgScheduleNotifGroupScene } from './tg-schedule-notif-group.scene';
import { TgScheduleNotifTeacherScene } from './tg-schedule-notif-teacher.scene';
import { TgScheduleNotifTransport } from './tg-schedule-notif.transport';
import { TgScheduleNotifUpdate } from './tg-schedule-notif.update';

@Module({
  providers: [
    TgScheduleNotifTransport,
    TgScheduleNotifUpdate,
    TgScheduleNotifGroupScene,
    TgScheduleNotifTeacherScene,
    TgGroupPicker,
  ],
})
export class TgScheduleNotifModule {}
