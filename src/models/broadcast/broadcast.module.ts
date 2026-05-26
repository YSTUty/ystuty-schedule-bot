import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { UserSocial } from '../user/entity/user-social.entity';

import { BROADCAST_QUEUE_NAME } from './broadcast.constants';
import { BroadcastProcessor } from './broadcast.processor';
import { BroadcastService } from './broadcast.service';
import { BroadcastCampaign } from './entity/broadcast-campaign.entity';
import { BroadcastDelivery } from './entity/broadcast-delivery.entity';
import { BroadcastAudienceFilterService } from './filter/broadcast-audience-filter.service';
import { BroadcastTransportRegistry } from './transport/broadcast-transport.registry';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: BROADCAST_QUEUE_NAME }),
    TypeOrmModule.forFeature([
      BroadcastCampaign,
      BroadcastDelivery,
      UserSocial,
    ]),
  ],
  providers: [
    BroadcastService,
    BroadcastProcessor,
    BroadcastAudienceFilterService,
    BroadcastTransportRegistry,
  ],
  exports: [
    BroadcastService,
    BroadcastAudienceFilterService,
    BroadcastTransportRegistry,
  ],
})
export class BroadcastModule {}
