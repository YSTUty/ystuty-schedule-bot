import { Module } from '@nestjs/common';

import { TgGroupPicker } from '../tg-group-picker';

import { TgScheduleNotifGroupScene } from './tg-schedule-notif-group.scene';
import { TgScheduleNotifTransport } from './tg-schedule-notif.transport';
import { TgScheduleNotifUpdate } from './tg-schedule-notif.update';

@Module({
  providers: [
    TgScheduleNotifTransport,
    TgScheduleNotifUpdate,
    TgScheduleNotifGroupScene,
    TgGroupPicker,
  ],
})
export class TgScheduleNotifModule {}
