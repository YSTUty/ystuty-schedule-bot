import { ListenerDecorator, matchMessageEventPayload } from 'nestjs-vk';

import { LocalePhrase } from '@my-interfaces';

import { MainUpdate } from './main.update';

const getMessageEventCondition = (target: object, methodName: string) => {
  const method = (target as Record<string, object>)[methodName];
  const listeners = Reflect.getMetadata(ListenerDecorator.KEY, method) as {
    handlerType: string;
    event: unknown;
  }[];

  return listeners.find((listener) => listener.handlerType === 'message_event')
    ?.event;
};

describe('VK MainUpdate', () => {
  const openTeachersList = jest.fn();
  const isTeacherSearchFallbackQuery = jest.fn();
  const update = new MainUpdate(
    {} as any,
    {} as any,
    { isTeacherSearchFallbackQuery } as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (update as any).openTeachersList = openTeachersList;
  });

  it('registers each main callback action with its own payload condition', () => {
    expect(
      getMessageEventCondition(MainUpdate.prototype, 'onTeacherList'),
    ).toEqual({ teacherAction: 'list' });
    expect(
      getMessageEventCondition(MainUpdate.prototype, 'onTeacherSelect'),
    ).toEqual({ teacherAction: 'select' });
    expect(
      getMessageEventCondition(MainUpdate.prototype, 'onGroupInstitutes'),
    ).toEqual({ groupAction: 'institutes' });
    expect(
      getMessageEventCondition(MainUpdate.prototype, 'onGroupList'),
    ).toEqual({ groupAction: 'groups' });
    expect(
      getMessageEventCondition(MainUpdate.prototype, 'onGroupSelect'),
    ).toEqual({ groupAction: 'select' });
  });

  it.each([
    ['onNope', { nope: {} }, { teacherAction: 'list' }],
    [
      'onGroupInstitutes',
      { groupAction: 'institutes' },
      { groupAction: 'groups' },
    ],
    ['onGroupList', { groupAction: 'groups' }, { groupAction: 'select' }],
    ['onGroupSelect', { groupAction: 'select' }, { groupAction: 'groups' }],
    ['onTeacherList', { teacherAction: 'list' }, { teacherAction: 'select' }],
    ['onTeacherSelect', { teacherAction: 'select' }, { teacherAction: 'list' }],
    [
      'onOpenTeachersList',
      { phrase: LocalePhrase.Button_Schedule_Teacher },
      { phrase: LocalePhrase.Button_SelectGroup },
    ],
    [
      'onOpenGroupSelect',
      { phrase: LocalePhrase.Button_SelectGroup },
      { phrase: LocalePhrase.Button_Schedule_Teacher },
    ],
    [
      'onAuthLink',
      { phrase: LocalePhrase.Button_AuthLink },
      { phrase: LocalePhrase.Button_Schedule_Teacher },
    ],
  ])(
    'routes %s only to its matching message-event payload',
    (methodName, matchingPayload, foreignPayload) => {
      const condition = getMessageEventCondition(
        MainUpdate.prototype,
        methodName,
      );

      expect(
        matchMessageEventPayload(matchingPayload, condition as any, {} as any),
      ).toBe(true);
      expect(
        matchMessageEventPayload(foreignPayload, condition as any, {} as any),
      ).toBe(false);
    },
  );

  it('opens a filtered teacher list for a matching fallback message in a DM', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(true);
    const ctx = { isDM: true, text: 'Шулев' } as any;

    await update.onHearFallback(ctx);

    expect(openTeachersList).toHaveBeenCalledWith(ctx, 'Шулев');
  });

  it('ignores fallback text in a VK group chat', async () => {
    const ctx = { isDM: false, text: 'Шулев' } as any;

    await update.onHearFallback(ctx);

    expect(openTeachersList).not.toHaveBeenCalled();
    expect(isTeacherSearchFallbackQuery).not.toHaveBeenCalled();
  });

  it('does not open a VK teacher list for unrelated DM text', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(false);
    const ctx = { isDM: true, text: 'аудитория' } as any;

    await update.onHearFallback(ctx);

    expect(isTeacherSearchFallbackQuery).toHaveBeenCalledWith('аудитория');
    expect(openTeachersList).not.toHaveBeenCalled();
  });

  it('marks the conversation as left when the bot is kicked from a VK chat', async () => {
    const conversation = { isLeaved: false };

    await update.onChatKickUser({
      $groupId: 42,
      eventMemberId: -42,
      state: { conversation },
    } as any);

    expect(conversation.isLeaved).toBe(true);
  });

  it('does not change isLeaved when another VK chat member is kicked', async () => {
    const conversation = { isLeaved: false };

    await update.onChatKickUser({
      $groupId: 42,
      eventMemberId: 7,
      state: { conversation },
    } as any);

    expect(conversation.isLeaved).toBe(false);
  });

  it('restores the conversation when the bot is invited back to a VK chat', async () => {
    const conversation = { isLeaved: true, groupName: 'ЦИС-21' };
    const ctx = {
      $groupId: 42,
      eventMemberId: -42,
      senderId: 7,
      peerId: 2_000_000_001,
      state: { conversation, userSocial: { id: 3 } },
      sessionConversation: {},
      i18n: { t: jest.fn().mockReturnValue('start') },
      send: jest.fn(),
    } as any;
    (update as any).keyboardFactory.getStart = jest.fn().mockReturnValue({});

    await update.onChatInviteUser(ctx);

    expect(conversation.isLeaved).toBe(false);
  });
});
