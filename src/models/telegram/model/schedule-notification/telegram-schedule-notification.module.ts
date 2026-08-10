import { Module } from '@nestjs/common';

import { TelegramScheduleNotificationTransport } from './telegram-schedule-notification.transport';
import { TelegramScheduleNotificationUpdate } from './telegram-schedule-notification.update';

@Module({
  providers: [
    TelegramScheduleNotificationTransport,
    TelegramScheduleNotificationUpdate,
  ],
})
export class TelegramScheduleNotificationModule {}
