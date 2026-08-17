import {
  ListenerDecorator,
  matchMessageEventPayload,
  OnMessageEvent,
} from 'nestjs-vk';

describe('OnMessageEvent', () => {
  it('marks the handler for message-event registration', () => {
    class TestUpdate {
      @OnMessageEvent()
      onMessageEvent() {}
    }

    const handler = TestUpdate.prototype.onMessageEvent;

    expect(Reflect.getMetadata(ListenerDecorator.KEY, handler)).toEqual([
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

    expect(Reflect.getMetadata(ListenerDecorator.KEY, handler)).toEqual([
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

  it('matches a string payload and stores its match on the context', () => {
    const context = {} as any;

    expect(
      matchMessageEventPayload('teacher:42', /^teacher:(\d+)$/, context),
    ).toBe(true);
    expect(context.$match?.[1]).toBe('42');
  });
});
