import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScheduleNotificationDelivery } from './entity/schedule-notification-delivery.entity';
import { ScheduleNotification } from './entity/schedule-notification.entity';
import { ScheduleNotificationDeliveryService } from './schedule-notification-delivery.service';
import { ScheduleNotificationScheduler } from './schedule-notification.scheduler';
import { ScheduleNotificationService } from './schedule-notification.service';
import { ScheduleNotificationTransportRegistry } from './transport/schedule-notification-transport.registry';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleNotification,
      ScheduleNotificationDelivery,
    ]),
  ],
  providers: [
    ScheduleNotificationService,
    ScheduleNotificationDeliveryService,
    ScheduleNotificationScheduler,
    ScheduleNotificationTransportRegistry,
  ],
  exports: [
    ScheduleNotificationService,
    ScheduleNotificationTransportRegistry,
  ],
})
export class ScheduleNotificationModule {}
