import { Injectable } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { ScheduleNotifTransport } from './schedule-notif.transport';

@Injectable()
export class ScheduleNotifTransportRegistry {
  private readonly transports = new Map<
    SocialType,
    ScheduleNotifTransport
  >();

  public register(transport: ScheduleNotifTransport) {
    this.transports.set(transport.social, transport);
  }

  public get(social: SocialType): ScheduleNotifTransport {
    const transport = this.transports.get(social);
    if (!transport) {
      throw new Error(
        `Schedule notif transport is not registered: ${social}`,
      );
    }

    return transport;
  }
}
