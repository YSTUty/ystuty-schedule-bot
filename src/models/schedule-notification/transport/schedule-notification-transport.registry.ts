import { Injectable } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { ScheduleNotificationTransport } from './schedule-notification.transport';

@Injectable()
export class ScheduleNotificationTransportRegistry {
  private readonly transports = new Map<
    SocialType,
    ScheduleNotificationTransport
  >();

  public register(transport: ScheduleNotificationTransport) {
    this.transports.set(transport.social, transport);
  }

  public get(social: SocialType): ScheduleNotificationTransport {
    const transport = this.transports.get(social);
    if (!transport) {
      throw new Error(
        `Schedule notification transport is not registered: ${social}`,
      );
    }

    return transport;
  }
}
