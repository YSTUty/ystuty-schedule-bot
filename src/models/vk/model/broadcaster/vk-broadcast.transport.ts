import { Injectable, OnModuleInit } from '@nestjs/common';

import { APIError } from 'vk-io';

import { SocialType } from '@my-common/constants';
import { i18n as i18nVk } from '@my-common/util/vk';
import { IContext } from '@my-interfaces/vk';

import {
  BroadcastCampaignStatus,
  BroadcastFeedbackButton,
  BroadcastMessageMode,
  BroadcastTransport,
  BroadcastTransportResult,
} from '../../../broadcast/broadcast.types';
import { BroadcastTransportRegistry } from '../../../broadcast/transport/broadcast-transport.registry';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { VkService } from '../../vk.service';

@Injectable()
export class VkBroadcastTransport implements BroadcastTransport, OnModuleInit {
  public readonly social = SocialType.Vkontakte;
  private readonly fakeCtx = {
    i18n: i18nVk.createContext('ru', {}),
  } as IContext;

  constructor(
    private readonly vkService: VkService,
    private readonly registry: BroadcastTransportRegistry,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  public async sendCampaignDelivery(params: {
    campaignId: number;
    deliveryId: number;
    targetSocialId: string;
    mode: BroadcastMessageMode;
    sourceMessage: { text?: string; attachment?: string; stickerId?: number };
    feedbackButton?: BroadcastFeedbackButton | null;
  }): Promise<BroadcastTransportResult> {
    if (params.mode !== BroadcastMessageMode.Text) {
      throw new Error('VK broadcast supports text mode');
    }

    if (params.sourceMessage.stickerId) {
      const result = await this.vkService.sendMessage(
        Number(params.targetSocialId),
        '',
        {
          sticker_id: params.sourceMessage.stickerId,
          ...this.getFeedbackExtra(params),
        },
      );

      return { messageId: result ? String(result) : null };
    }

    const result = await this.vkService.sendMessage(
      Number(params.targetSocialId),
      params.sourceMessage.text || '',
      params.sourceMessage.attachment
        ? {
            attachment: params.sourceMessage.attachment,
            ...this.getFeedbackExtra(params),
          }
        : this.getFeedbackExtra(params),
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

  private getFeedbackExtra(params: {
    campaignId: number;
    deliveryId: number;
    feedbackButton?: BroadcastFeedbackButton | null;
  }) {
    if (!params.feedbackButton) return {};
    return {
      keyboard: this.keyboardFactory
        .getBroadcastFeedbackButton(
          params.feedbackButton.text,
          params.deliveryId,
        )
        .inline(),
    };
  }

  public async updateCampaignProgress(params: {
    reportMessage: { chatId: number; messageId: number };
    status: BroadcastCampaignStatus;
    paused: boolean;
    text: string;
  }): Promise<boolean> {
    const isFinal = [
      BroadcastCampaignStatus.Completed,
      BroadcastCampaignStatus.Terminated,
      BroadcastCampaignStatus.Failed,
    ].includes(params.status);
    const result = await this.vkService.tryEditOrSendMessage(
      params.reportMessage.chatId,
      { conversation_message_id: params.reportMessage.messageId },
      params.text.replace(/<[^>]+>/g, ''),
      isFinal
        ? { keyboard: this.keyboardFactory.getClose().inline() }
        : {
            keyboard: this.keyboardFactory
              .getBroadcastQueueControls(this.fakeCtx, params.paused)
              .inline(),
          },
    );

    return !!result;
  }
}
