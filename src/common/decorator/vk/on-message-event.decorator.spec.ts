import { VK_LISTENERS_METADATA } from 'nestjs-vk/dist/vk.constants';

import { ADMIN_GUARD_NEXT } from './admin-guard-next.decorator';
import { OnMessageEvent } from './on-message-event.decorator';

describe('OnMessageEvent', () => {
  it('marks the handler for both message-event registration and guard continuation', () => {
    class TestUpdate {
      @OnMessageEvent()
      onMessageEvent() {}
    }

    const handler = TestUpdate.prototype.onMessageEvent;

    expect(Reflect.getMetadata(ADMIN_GUARD_NEXT, handler)).toBe(true);
    expect(Reflect.getMetadata(VK_LISTENERS_METADATA, handler)).toEqual([
      expect.objectContaining({
        handlerType: 'vk_updates',
        method: 'on',
        event: 'message_event',
      }),
    ]);
  });
});
