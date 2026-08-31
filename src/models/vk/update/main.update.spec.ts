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
    expect(
      getMessageEventCondition(MainUpdate.prototype, 'onHelpMessageEvent'),
    ).toEqual({ mainAction: 'help' });
  });

  it('acknowledges the inline help button before showing help', async () => {
    const keyboard = { inline: jest.fn().mockReturnValue('start') };
    (update as any).keyboardFactory.getStart = jest
      .fn()
      .mockReturnValue(keyboard);
    (update as any).keyboardFactory.needInline = jest
      .fn()
      .mockReturnValue(false);
    const ctx = {
      isDM: true,
      state: {},
      i18n: { t: jest.fn().mockReturnValue('Помощь') },
      answer: jest.fn(),
      send: jest.fn(),
    } as any;

    await update.onHelpMessageEvent(ctx);

    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'Открываю справку',
    });
    expect(ctx.send).toHaveBeenCalledWith('Помощь', { keyboard: 'start' });
  });

  it('sends a feature card after the start message in a VK DM', async () => {
    const startKeyboard = { inline: jest.fn().mockReturnValue('start') };
    const welcomeKeyboard = { inline: jest.fn().mockReturnValue('welcome') };
    (update as any).keyboardFactory.getStart = jest
      .fn()
      .mockReturnValue(startKeyboard);
    (update as any).keyboardFactory.getWelcomeFeatures = jest
      .fn()
      .mockReturnValue(welcomeKeyboard);
    (update as any).keyboardFactory.needInline = jest
      .fn()
      .mockReturnValue(false);
    const ctx = {
      isChat: false,
      isDM: true,
      $match: [],
      state: { user: { id: 1 }, userSocial: { groupName: 'ЦИС-11' } },
      session: {},
      i18n: { t: jest.fn((phrase) => phrase) },
      send: jest.fn(),
    } as any;

    await update.hearStart(ctx);

    expect(ctx.send).toHaveBeenNthCalledWith(1, LocalePhrase.Page_Start, {
      keyboard: 'start',
    });
    expect(ctx.send).toHaveBeenNthCalledWith(
      2,
      LocalePhrase.Page_WelcomeFeatures,
      { keyboard: 'welcome' },
    );
  });

  it('does not send the feature card on start in a VK chat', async () => {
    const ctx = {
      isChat: true,
      isDM: false,
      state: { appeal: true, userSocial: { groupName: 'ЦИС-11' } },
      session: {},
      $match: [],
      i18n: { t: jest.fn((phrase) => phrase) },
      send: jest.fn(),
    } as any;
    (update as any).keyboardFactory.getStart = jest
      .fn()
      .mockReturnValue({ inline: jest.fn().mockReturnValue('start') });
    (update as any).keyboardFactory.needInline = jest
      .fn()
      .mockReturnValue(true);
    (update as any).keyboardFactory.getWelcomeFeatures = jest.fn();

    await update.hearStart(ctx);

    expect(
      (update as any).keyboardFactory.getWelcomeFeatures,
    ).not.toHaveBeenCalled();
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
    const ctx = {
      isDM: true,
      isMessageContext: jest.fn().mockReturnValue(true),
      text: 'Шулев',
    } as any;

    await update.onHearFallback(ctx);

    expect(openTeachersList).toHaveBeenCalledWith(ctx, 'Шулев');
  });

  it('ignores fallback text in a VK group chat', async () => {
    const ctx = {
      isDM: false,
      isMessageContext: jest.fn(),
      text: 'Шулев',
    } as any;

    await update.onHearFallback(ctx);

    expect(openTeachersList).not.toHaveBeenCalled();
    expect(isTeacherSearchFallbackQuery).not.toHaveBeenCalled();
  });

  it('replies to an unhandled VK DM message with an inline help button', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(false);
    const keyboard = { inline_keyboard: [] };
    (update as any).keyboardFactory.getUnknownMessageHelp = jest
      .fn()
      .mockReturnValue(keyboard);
    const ctx = {
      isDM: true,
      isMessageContext: jest.fn().mockReturnValue(true),
      text: 'аудитория',
      i18n: { t: jest.fn().mockReturnValue('Не понял сообщение.') },
      send: jest.fn(),
    } as any;

    await update.onHearFallback(ctx);

    expect(isTeacherSearchFallbackQuery).toHaveBeenCalledWith('аудитория');
    expect(openTeachersList).not.toHaveBeenCalled();
    expect(
      (update as any).keyboardFactory.getUnknownMessageHelp,
    ).toHaveBeenCalledWith(ctx);
    expect(ctx.i18n.t).toHaveBeenCalledWith(LocalePhrase.Page_UnknownMessage);
    expect(ctx.send).toHaveBeenCalledWith('Не понял сообщение.', { keyboard });
  });

  it('does not reply to a VK message event', async () => {
    const ctx = {
      isDM: true,
      isMessageContext: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    } as any;

    await update.onHearFallback(ctx);

    expect(isTeacherSearchFallbackQuery).not.toHaveBeenCalled();
    expect(openTeachersList).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('does not reply to a VK DM attachment without text', async () => {
    const ctx = {
      isDM: true,
      isMessageContext: jest.fn().mockReturnValue(true),
      text: undefined,
      send: jest.fn(),
    } as any;

    await update.onHearFallback(ctx);

    expect(isTeacherSearchFallbackQuery).not.toHaveBeenCalled();
    expect(openTeachersList).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('renders the invite keyboard from the current VK group id', async () => {
    const keyboard = { inline: jest.fn().mockReturnValue('keyboard') };
    (update as any).keyboardFactory.getInviteToChat = jest
      .fn()
      .mockReturnValue(keyboard);
    const ctx = { send: jest.fn(), $groupId: 182_322_377 } as any;

    await update.onInvite(ctx);

    expect(
      (update as any).keyboardFactory.getInviteToChat,
    ).toHaveBeenCalledWith(ctx);
    expect(ctx.send).toHaveBeenCalledWith('Пригласить бота в беседу:', {
      keyboard: 'keyboard',
    });
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
