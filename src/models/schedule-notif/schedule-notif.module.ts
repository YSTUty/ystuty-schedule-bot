import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import { ScheduleNotifDeliveryService } from './schedule-notif-delivery.service';
import { ScheduleNotifDraftService } from './schedule-notif-draft.service';
import { ScheduleNotifQueueService } from './schedule-notif-queue.service';
import { getScheduleNotifRetryBackoffMs } from './schedule-notif.config';
import {
  SCHEDULE_NOTIF_TELEGRAM_QUEUE_NAME,
  SCHEDULE_NOTIF_VK_QUEUE_NAME,
} from './schedule-notif.constants';
import {
  TelegramScheduleNotifProcessor,
  VkScheduleNotifProcessor,
} from './schedule-notif.processor';
import { ScheduleNotifScheduler } from './schedule-notif.scheduler';
import { ScheduleNotifService } from './schedule-notif.service';
import { ScheduleNotifTransportRegistry } from './transport/schedule-notif-transport.registry';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: SCHEDULE_NOTIF_TELEGRAM_QUEUE_NAME,
        limiter: { max: 3, duration: 1e3 },
        settings: {
          backoffStrategies: {
            schedule_notif_retry: getScheduleNotifRetryBackoffMs,
          },
        },
      },
      {
        name: SCHEDULE_NOTIF_VK_QUEUE_NAME,
        limiter: { max: 3, duration: 1e3 },
        settings: {
          backoffStrategies: {
            schedule_notif_retry: getScheduleNotifRetryBackoffMs,
          },
        },
      },
    ),
    TypeOrmModule.forFeature([ScheduleNotif, ScheduleNotifDelivery]),
  ],
  providers: [
    ScheduleNotifService,
    ScheduleNotifDraftService,
    ScheduleNotifDeliveryService,
    ScheduleNotifQueueService,
    ScheduleNotifScheduler,
    TelegramScheduleNotifProcessor,
    VkScheduleNotifProcessor,
    ScheduleNotifTransportRegistry,
  ],
  exports: [
    ScheduleNotifService,
    ScheduleNotifDraftService,
    ScheduleNotifTransportRegistry,
  ],
})
export class ScheduleNotifModule {}
