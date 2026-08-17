import { Injectable, OnModuleInit } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { ScheduleNotifTransportRegistry } from '../../../schedule-notif/transport/schedule-notif-transport.registry';
import { ScheduleNotifTransport } from '../../../schedule-notif/transport/schedule-notif.transport';
import { TelegramService } from '../../telegram.service';

@Injectable()
export class TgScheduleNotifTransport
  implements ScheduleNotifTransport, OnModuleInit
{
  public readonly social = SocialType.Telegram;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transportRegistry: ScheduleNotifTransportRegistry,
  ) {}

  public onModuleInit() {
    if (this.telegramService.isActive) {
      this.transportRegistry.register(this);
    }
  }

  public async sendScheduleNotif(
    params: Parameters<ScheduleNotifTransport['sendScheduleNotif']>[0],
  ) {
    const chatId =
      params.recipient.type === 'user'
        ? params.recipient.userSocial.socialId
        : params.recipient.conversationId;
    const message = await this.telegramService.sendMessage(chatId, params.text);
    if (!message) {
      throw new Error('Telegram did not accept the schedule notif');
    }
    return { messageId: String(message.message_id) };
  }

  /** Отправляет личное сервисное сообщение получателю рассылки. */
  public async sendMessage(
    params: Parameters<ScheduleNotifTransport['sendMessage']>[0],
  ) {
    const message = await this.telegramService.sendMessage(
      params.recipient.socialId,
      params.text,
    );
    if (!message) {
      throw new Error('Telegram did not accept the schedule notif');
    }
    return { messageId: String(message.message_id) };
  }
}
