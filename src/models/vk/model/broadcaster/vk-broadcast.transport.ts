import { Injectable, OnModuleInit } from '@nestjs/common';

import { APIError } from 'vk-io';

import { SocialType } from '@my-common/constants';

import {
  BroadcastMessageMode,
  BroadcastTransport,
  BroadcastTransportResult,
} from '../../../broadcast/broadcast.types';
import { BroadcastTransportRegistry } from '../../../broadcast/transport/broadcast-transport.registry';
import { VkService } from '../../vk.service';

@Injectable()
export class VkBroadcastTransport implements BroadcastTransport, OnModuleInit {
  public readonly social = SocialType.Vkontakte;

  constructor(
    private readonly vkService: VkService,
    private readonly registry: BroadcastTransportRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  public async sendCampaignDelivery(params: {
    targetSocialId: string;
    mode: BroadcastMessageMode;
    sourceMessage: { text?: string };
  }): Promise<BroadcastTransportResult> {
    if (
      params.mode !== BroadcastMessageMode.Text ||
      !params.sourceMessage.text
    ) {
      throw new Error('VK broadcast supports text mode only');
    }

    const result = await this.vkService.sendMessage(
      Number(params.targetSocialId),
      params.sourceMessage.text,
    );

    return {
      messageId: result ? String(result) : null,
    };
  }

  public async deleteCampaignDelivery(params: {
    targetSocialId: string;
    messageId: string;
  }): Promise<boolean> {
    try {
      await this.vkService.bot.api.messages.delete({
        peer_id: Number(params.targetSocialId),
        message_ids: [Number(params.messageId)],
        delete_for_all: 1,
      });
      return true;
    } catch (err) {
      if (err instanceof APIError) return false;
      throw err;
    }
  }
}
