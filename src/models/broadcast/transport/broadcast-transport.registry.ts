import { Injectable } from '@nestjs/common';

import { SocialType } from '@my-common/constants';

import { BroadcastTransport } from '../broadcast.types';

@Injectable()
export class BroadcastTransportRegistry {
  private readonly transports = new Map<SocialType, BroadcastTransport>();

  public register(transport: BroadcastTransport) {
    this.transports.set(transport.social, transport);
  }

  public get(social: SocialType): BroadcastTransport {
    const transport = this.transports.get(social);
    if (!transport) {
      throw new Error(`Broadcast transport is not registered: ${social}`);
    }

    return transport;
  }
}
