import { Injectable, OnModuleInit } from '@nestjs/common';

import { TelegramError } from 'telegraf';

import { SocialType } from '@my-common/constants';
import { i18n as i18nTg } from '@my-common/util/tg';
import { IContext } from '@my-interfaces/telegram';

import {
  BroadcastCampaignStatus,
  BroadcastMessageMode,
  BroadcastTransport,
  BroadcastTransportResult,
} from '../../../broadcast/broadcast.types';
import { BroadcastTransportRegistry } from '../../../broadcast/transport/broadcast-transport.registry';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { TelegramService } from '../../telegram.service';

@Injectable()
export class TelegramBroadcastTransport
  implements BroadcastTransport, OnModuleInit
{
  public readonly social = SocialType.Telegram;
  private readonly fakeCtx = {
    i18n: i18nTg.createContext('ru', {}),
  } as IContext;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly registry: BroadcastTransportRegistry,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  public async sendCampaignDelivery(params: {
    targetSocialId: string;
    mode: BroadcastMessageMode;
    sourceMessage: { chatId?: number; messageId?: number; text?: string };
  }): Promise<BroadcastTransportResult> {
    const chatId = Number(params.targetSocialId);

    if (params.mode === BroadcastMessageMode.Copy) {
      if (!params.sourceMessage.chatId || !params.sourceMessage.messageId) {
        throw new Error('Telegram broadcast requires source message');
      }

      const result = await this.telegramService.bot.telegram.copyMessage(
        chatId,
        params.sourceMessage.chatId,
        params.sourceMessage.messageId,
      );

      return { messageId: String(result.message_id) };
    }

    if (params.mode === BroadcastMessageMode.Forward) {
      if (!params.sourceMessage.chatId || !params.sourceMessage.messageId) {
        throw new Error('Telegram broadcast requires source message');
      }

      const result = await this.telegramService.bot.telegram.forwardMessage(
        chatId,
        params.sourceMessage.chatId,
        params.sourceMessage.messageId,
      );

      return { messageId: String(result.message_id) };
    }

    if (!params.sourceMessage.text) {
      throw new Error('Telegram text broadcast requires text');
    }

    const result = await this.telegramService.bot.telegram.sendMessage(
      chatId,
      params.sourceMessage.text,
      { parse_mode: 'HTML' },
    );

    return { messageId: String(result.message_id) };
  }

  public async deleteCampaignDelivery(params: {
    targetSocialId: string;
    messageId: string;
  }): Promise<boolean> {
    try {
      await this.telegramService.bot.telegram.deleteMessage(
        Number(params.targetSocialId),
        Number(params.messageId),
      );
      return true;
    } catch (err) {
      if (err instanceof TelegramError) return false;
      throw err;
    }
  }

  public async updateCampaignProgress(params: {
    reportMessage: { chatId: number; messageId: number };
    status: BroadcastCampaignStatus;
    paused: boolean;
    text: string;
  }): Promise<boolean> {
    try {
      const isFinal = [
        BroadcastCampaignStatus.Completed,
        BroadcastCampaignStatus.Terminated,
        BroadcastCampaignStatus.Failed,
      ].includes(params.status);
      await this.telegramService.bot.telegram.editMessageText(
        params.reportMessage.chatId,
        params.reportMessage.messageId,
        undefined,
        params.text,
        {
          parse_mode: 'HTML',
          ...(isFinal
            ? this.keyboardFactory.getClear(true)
            : this.keyboardFactory.getBroadcastQueueControls(
                this.fakeCtx,
                params.paused,
              )),
        },
      );
      return true;
    } catch (err) {
      if (err instanceof TelegramError) return false;
      throw err;
    }
  }
}
