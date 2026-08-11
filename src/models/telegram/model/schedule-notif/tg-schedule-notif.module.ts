import { Module } from '@nestjs/common';

import { TgScheduleNotifGroupScene } from './tg-schedule-notif-group.scene';
import { TgScheduleNotifTransport } from './tg-schedule-notif.transport';
import { TgScheduleNotifUpdate } from './tg-schedule-notif.update';
import { TgGroupPicker } from '../tg-group-picker';

@Module({
  providers: [
    TgScheduleNotifTransport,
    TgScheduleNotifUpdate,
    TgScheduleNotifGroupScene,
    TgGroupPicker,
  ],
})
export class TgScheduleNotifModule {}
