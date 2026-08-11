import { Injectable, OnModuleInit } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { ScheduleNotificationTransportRegistry } from '../../../schedule-notification/transport/schedule-notification-transport.registry';
import { ScheduleNotificationTransport } from '../../../schedule-notification/transport/schedule-notification.transport';
import { TelegramService } from '../../telegram.service';

@Injectable()
export class TelegramScheduleNotificationTransport
  implements ScheduleNotificationTransport, OnModuleInit
{
  public readonly social = SocialType.Telegram;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transportRegistry: ScheduleNotificationTransportRegistry,
  ) {}

  public onModuleInit() {
    if (this.telegramService.isActive) {
      this.transportRegistry.register(this);
    }
  }

  public async sendScheduleNotification(
    params: Parameters<
      ScheduleNotificationTransport['sendScheduleNotification']
    >[0],
  ) {
    return await this.sendMessage(params);
  }

  /** Отправляет личное сервисное сообщение получателю рассылки. */
  public async sendMessage(
    params: Parameters<ScheduleNotificationTransport['sendMessage']>[0],
  ) {
    const message = await this.telegramService.sendMessage(
      params.recipient.socialId,
      params.text,
    );
    if (!message) {
      throw new Error('Telegram did not accept the schedule notification');
    }
    return { messageId: String(message.message_id) };
  }
}
