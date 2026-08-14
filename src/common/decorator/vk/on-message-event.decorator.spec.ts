import { matchMessageEventPayload, OnMessageEvent } from 'nestjs-vk';
import { VK_LISTENERS_METADATA } from 'nestjs-vk/dist/vk.constants';

describe('OnMessageEvent', () => {
  it('marks the handler for message-event registration', () => {
    class TestUpdate {
      @OnMessageEvent()
      onMessageEvent() {}
    }

    const handler = TestUpdate.prototype.onMessageEvent;

    expect(Reflect.getMetadata(VK_LISTENERS_METADATA, handler)).toEqual([
      expect.objectContaining({
        handlerType: 'message_event',
      }),
    ]);
  });

  it('stores a payload condition for listener routing', () => {
    class TestUpdate {
      @OnMessageEvent({ teacherAction: 'list' })
      onTeacherList() {}
    }

    const handler = TestUpdate.prototype.onTeacherList;

    expect(Reflect.getMetadata(VK_LISTENERS_METADATA, handler)).toEqual([
      expect.objectContaining({
        handlerType: 'message_event',
        event: { teacherAction: 'list' },
      }),
    ]);
  });

  it('skips a listener when its payload condition does not match', () => {
    expect(
      matchMessageEventPayload(
        { groupAction: 'select' },
        { teacherAction: 'list' },
        {} as never,
      ),
    ).toBe(false);
  });
});
