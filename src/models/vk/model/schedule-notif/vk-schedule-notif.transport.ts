import { Injectable, OnModuleInit } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { ScheduleNotifTransportRegistry } from '../../../schedule-notif/transport/schedule-notif-transport.registry';
import { ScheduleNotifTransport } from '../../../schedule-notif/transport/schedule-notif.transport';
import { VkService } from '../../vk.service';

@Injectable()
export class VkScheduleNotifTransport
  implements ScheduleNotifTransport, OnModuleInit
{
  public readonly social = SocialType.Vkontakte;

  constructor(
    private readonly vkService: VkService,
    private readonly transportRegistry: ScheduleNotifTransportRegistry,
  ) {}

  public onModuleInit() {
    if (this.vkService.isActive) {
      this.transportRegistry.register(this);
    }
  }

  public async sendScheduleNotif(
    params: Parameters<
      ScheduleNotifTransport['sendScheduleNotif']
    >[0],
  ) {
    return await this.sendMessage(params);
  }

  /** Отправляет личное сервисное сообщение получателю рассылки. */
  public async sendMessage(
    params: Parameters<ScheduleNotifTransport['sendMessage']>[0],
  ) {
    const messageId = await this.vkService.sendMessage(
      params.recipient.socialId,
      params.text,
    );
    if (!messageId || !Array.isArray(messageId)) {
      throw new Error('VK did not accept the schedule notif');
    }
    // TODO: conversation_message_id | message_id | peer_id
    return { messageId: String(messageId[0].conversation_message_id) };
  }
}
