import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import { ScheduleNotifDeliveryService } from './schedule-notif-delivery.service';
import { ScheduleNotifScheduler } from './schedule-notif.scheduler';
import { ScheduleNotifService } from './schedule-notif.service';
import { ScheduleNotifTransportRegistry } from './transport/schedule-notif-transport.registry';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ScheduleNotif, ScheduleNotifDelivery])],
  providers: [
    ScheduleNotifService,
    ScheduleNotifDeliveryService,
    ScheduleNotifScheduler,
    ScheduleNotifTransportRegistry,
  ],
  exports: [ScheduleNotifService, ScheduleNotifTransportRegistry],
})
export class ScheduleNotifModule {}
