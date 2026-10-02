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
    params: Parameters<ScheduleNotifTransport['sendScheduleNotif']>[0],
  ) {
    const peerId =
      params.recipient.type === 'user'
        ? params.recipient.userSocial.socialId
        : // only for vk conversation
          params.recipient.conversationId + 2e9;
    const messageId = params.html
      ? await this.vkService.sendMessageHtmlOrThrow(peerId, params.html)
      : await this.vkService.sendMessageOrThrow(peerId, params.text);
    return this.getMessageId(messageId);
  }

  /** Отправляет личное сервисное сообщение получателю рассылки. */
  public async sendMessage(
    params: Parameters<ScheduleNotifTransport['sendMessage']>[0],
  ) {
    const messageId = await this.vkService.sendMessageOrThrow(
      params.recipient.socialId,
      params.text,
    );
    return this.getMessageId(messageId);
  }

  /** Нормализует разные формы успешного ответа messages.send из vk-io. */
  private getMessageId(
    messageId: number | { conversation_message_id: number }[],
  ) {
    if (typeof messageId === 'number') {
      return { messageId: String(messageId) };
    }
    if (!messageId.length) {
      throw new Error('VK did not accept the schedule notif');
    }
    // TODO: conversation_message_id | message_id | peer_id
    return { messageId: String(messageId[0].conversation_message_id) };
  }
}
