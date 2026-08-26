import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { UserSocial } from '../user/entity/user-social.entity';

import {
  BROADCAST_TELEGRAM_QUEUE_NAME,
  BROADCAST_VK_QUEUE_NAME,
} from './broadcast.constants';
import {
  TelegramBroadcastProcessor,
  VkBroadcastProcessor,
} from './broadcast.processor';
import { BroadcastService } from './broadcast.service';
import { BroadcastCampaign } from './entity/broadcast-campaign.entity';
import { BroadcastDelivery } from './entity/broadcast-delivery.entity';
import { BroadcastFeedback } from './entity/broadcast-feedback.entity';
import { BroadcastAudienceFilterService } from './filter/broadcast-audience-filter.service';
import { BroadcastAudienceGroupFilterService } from './filter/broadcast-audience-group-filter.service';
import { BroadcastTransportRegistry } from './transport/broadcast-transport.registry';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: BROADCAST_TELEGRAM_QUEUE_NAME },
      { name: BROADCAST_VK_QUEUE_NAME },
    ),
    TypeOrmModule.forFeature([
      BroadcastCampaign,
      BroadcastDelivery,
      BroadcastFeedback,
      UserSocial,
    ]),
  ],
  providers: [
    BroadcastService,
    TelegramBroadcastProcessor,
    VkBroadcastProcessor,
    BroadcastAudienceFilterService,
    BroadcastAudienceGroupFilterService,
    BroadcastTransportRegistry,
  ],
  exports: [
    BroadcastService,
    BroadcastAudienceFilterService,
    BroadcastAudienceGroupFilterService,
    BroadcastTransportRegistry,
  ],
})
export class BroadcastModule {}
