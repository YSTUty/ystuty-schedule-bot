import { Module } from '@nestjs/common';

import { TelegramScheduleNotificationGroupScene } from './telegram-schedule-notification-group.scene';
import { TelegramScheduleNotificationTransport } from './telegram-schedule-notification.transport';
import { TelegramScheduleNotificationUpdate } from './telegram-schedule-notification.update';
import { TgGroupPicker } from '../tg-group-picker';

@Module({
  providers: [
    TelegramScheduleNotificationTransport,
    TelegramScheduleNotificationUpdate,
    TelegramScheduleNotificationGroupScene,
    TgGroupPicker,
  ],
})
export class TelegramScheduleNotificationModule {}
