import { VK_LISTENERS_METADATA } from 'nestjs-vk/dist/vk.constants';

import { BroadcastVkUpdate } from './broadcast-vk.update';

describe('BroadcastVkUpdate', () => {
  it('only routes supported broadcast callbacks', () => {
    const listener = Reflect.getMetadata(
      VK_LISTENERS_METADATA,
      BroadcastVkUpdate.prototype.onQueueAction,
    ).find(
      (item: { handlerType: string }) => item.handlerType === 'message_event',
    );

    expect(listener.event({ broadcastAction: 'menuPanel' }, {})).toBe(true);
    expect(listener.event({ broadcastAction: 'create' }, {})).toBe(false);
    expect(listener.event({ groupAction: 'select' }, {})).toBe(false);
  });
});
