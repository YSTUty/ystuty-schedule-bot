import { Injectable, OnModuleInit } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { ScheduleNotificationTransportRegistry } from '../../../schedule-notification/transport/schedule-notification-transport.registry';
import { ScheduleNotificationTransport } from '../../../schedule-notification/transport/schedule-notification.transport';
import { VkService } from '../../vk.service';

@Injectable()
export class VkScheduleNotificationTransport
  implements ScheduleNotificationTransport, OnModuleInit
{
  public readonly social = SocialType.Vkontakte;

  constructor(
    private readonly vkService: VkService,
    private readonly transportRegistry: ScheduleNotificationTransportRegistry,
  ) {}

  public onModuleInit() {
    if (this.vkService.isActive) {
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
    const messageId = await this.vkService.sendMessage(
      params.recipient.socialId,
      params.text,
    );
    if (!messageId || !Array.isArray(messageId)) {
      throw new Error('VK did not accept the schedule notification');
    }
    // TODO: conversation_message_id | message_id | peer_id
    return { messageId: String(messageId[0].conversation_message_id) };
  }
}
