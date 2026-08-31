import { TG_ALLOWED_CHAT_TYPES_KEY } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';

import { MainUpdate } from './main.update';

describe('Telegram MainUpdate', () => {
  const openTeachersList = jest.fn();
  const isTeacherSearchFallbackQuery = jest.fn();
  const update = new MainUpdate(
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

  it('renders the invite keyboard', async () => {
    const keyboard = { reply_markup: { inline_keyboard: [] } };
    (update as any).keyboardFactory.getInviteToChat = jest
      .fn()
      .mockReturnValue(keyboard);
    const ctx = { replyWithHTML: jest.fn() } as any;

    await update.onInvite(ctx);

    expect(
      (update as any).keyboardFactory.getInviteToChat,
    ).toHaveBeenCalledWith(ctx);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'Пригласить бота в группу:',
      keyboard,
    );
  });

  it('acknowledges the inline help button before showing help', async () => {
    const keyboard = { reply_markup: { keyboard: [] } };
    (update as any).keyboardFactory.getStart = jest
      .fn()
      .mockReturnValue(keyboard);
    const ctx = {
      updateType: 'callback_query',
      chat: { type: 'private' },
      state: {},
      i18n: { t: jest.fn().mockReturnValue('Помощь') },
      tryAnswerCbQuery: jest.fn(),
      replyWithHTML: jest.fn(),
    } as any;

    await update.hearHelp(ctx);

    expect(ctx.tryAnswerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith('Помощь', keyboard);
  });

  it('sends a feature card after the start message in a private chat', async () => {
    const startKeyboard = { reply_markup: { keyboard: [] } };
    const welcomeKeyboard = { reply_markup: { inline_keyboard: [] } };
    (update as any).keyboardFactory.getStart = jest
      .fn()
      .mockReturnValue(startKeyboard);
    (update as any).keyboardFactory.getWelcomeFeatures = jest
      .fn()
      .mockReturnValue(welcomeKeyboard);
    const ctx = {
      chat: { id: 7, type: 'private' },
      from: { id: 9 },
      message: { text: '/start' },
      session: {},
      user: { id: 1 },
      userSocial: { groupName: 'ЦИС-11' },
      replyWithHTML: jest.fn(),
    } as any;
    (update as any).telegramService.syncPrivateChatCommands = jest.fn();
    (update as any).telegramService.isAdmin = jest.fn().mockReturnValue(false);
    ctx.i18n = { t: jest.fn((phrase) => phrase) };

    await update.hearStart(ctx);

    expect(ctx.replyWithHTML).toHaveBeenNthCalledWith(
      1,
      LocalePhrase.Page_Start,
      startKeyboard,
    );
    expect(ctx.replyWithHTML).toHaveBeenNthCalledWith(
      2,
      LocalePhrase.Page_WelcomeFeatures,
      welcomeKeyboard,
    );
  });

  it('does not send the feature card on start in a group chat', async () => {
    const ctx = {
      chat: { id: -1001, type: 'group' },
      state: { appeal: true },
      session: {},
      message: { text: '/start' },
      userSocial: { groupName: 'ЦИС-11' },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
    } as any;
    (update as any).keyboardFactory.getStart = jest.fn().mockReturnValue({});
    (update as any).keyboardFactory.getWelcomeFeatures = jest.fn();

    await update.hearStart(ctx);

    expect(
      (update as any).keyboardFactory.getWelcomeFeatures,
    ).not.toHaveBeenCalled();
  });

  it('opens a filtered teacher list for a matching private text message', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(true);
    const ctx = { message: { text: 'Шулев' } } as any;
    const next = jest.fn();

    await update.onTeacherNameFallback(ctx, next);

    expect(openTeachersList).toHaveBeenCalledWith(ctx, 'Шулев');
  });

  it('does not open a list for unrelated private text', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(false);
    const ctx = { message: { text: 'аудитория' } } as any;
    const next = jest.fn();

    await update.onTeacherNameFallback(ctx, next);

    expect(openTeachersList).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not continue handlers after opening a teacher list', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(true);
    const next = jest.fn();

    await update.onTeacherNameFallback(
      { message: { text: 'Шулев' } } as any,
      next,
    );

    expect(next).not.toHaveBeenCalled();
  });

  it('continues Telegram handlers when an update has no text message', async () => {
    const next = jest.fn();

    await update.onTeacherNameFallback({ message: { photo: [] } } as any, next);

    expect(isTeacherSearchFallbackQuery).not.toHaveBeenCalled();
    expect(openTeachersList).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('registers the fallback only for private Telegram chats', () => {
    expect(
      Reflect.getMetadata(
        TG_ALLOWED_CHAT_TYPES_KEY,
        MainUpdate.prototype.onTeacherNameFallback,
      ),
    ).toEqual(['private']);
  });

  it('opens group selection from a group-chat callback made by the bot inviter', async () => {
    const scene = { enter: jest.fn() };
    const ctx = {
      from: { id: 7 },
      chat: { id: -1001, type: 'group' },
      state: { appeal: false },
      conversation: { invitedByUserSocialId: 3 },
      userSocial: { id: 3 },
      match: { groups: { groupName: 'ЦИС-17' } },
      callbackQuery: { data: 'selectGroup:ЦИС-17' },
      scene,
      tryAnswerCbQuery: jest.fn(),
      deleteMessage: jest.fn(),
    } as any;

    await update.hearSelectGroup(ctx);

    expect(scene.enter).toHaveBeenCalledWith('SELECT_GROUP_SCENE', {
      groupName: 'ЦИС-17',
    });
    expect(ctx.tryAnswerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.deleteMessage).toHaveBeenCalledTimes(1);
  });

  it('acknowledges an institute-list callback before editing its message', async () => {
    const calls: string[] = [];
    (update as any).scheduleService.groupsInstitutesList = jest.fn(() => ({
      items: ['Институт'],
      currentPage: 1,
      totalPages: 1,
    }));
    (update as any).keyboardFactory.getPagination = jest
      .fn()
      .mockReturnValue({});
    const ctx = {
      updateType: 'callback_query',
      callbackQuery: { data: 'pager:inst-list' },
      match: { groups: {} },
      tryAnswerCbQuery: jest.fn(async () => calls.push('answer')),
      editMessageText: jest.fn(async () => calls.push('edit')),
    } as any;

    await update.onInstitutesList(ctx);

    expect(calls).toEqual(['answer', 'edit']);
  });

  it.each([
    ['left', true],
    ['kicked', true],
    ['member', false],
    ['administrator', false],
  ])(
    'updates isLeaved to %s for a bot membership status',
    async (status, isLeaved) => {
      const conversation = { isLeaved: !isLeaved };
      const ctx = {
        botInfo: { id: 42 },
        userSocial: { id: 1 },
        conversation,
        myChatMember: {
          chat: { type: 'group', title: 'Расписание' },
          old_chat_member: { status: 'member' },
          new_chat_member: { status, user: { id: 42 } },
        },
        replyWithHTML: jest.fn(),
        i18n: { t: jest.fn().mockReturnValue('start') },
        sessionConversation: {},
      } as any;

      (update as any).keyboardFactory.getStart = jest.fn();
      (update as any).keyboardFactory.getSelectGroupInline = jest.fn();
      (update as any).telegramService.parseChatTitle = jest.fn();

      await update.onMyChatMember(ctx);

      expect(conversation.isLeaved).toBe(isLeaved);
    },
  );

  it('does not change isLeaved for another Telegram chat member', async () => {
    const conversation = { isLeaved: false };
    const ctx = {
      botInfo: { id: 42 },
      conversation,
      myChatMember: {
        chat: { type: 'group', title: 'Расписание' },
        old_chat_member: { status: 'member' },
        new_chat_member: { status: 'kicked', user: { id: 7 } },
      },
    } as any;

    await update.onMyChatMember(ctx);

    expect(conversation.isLeaved).toBe(false);
  });

  it('welcomes the bot only when it joins or returns to a Telegram chat', async () => {
    const createContext = (oldStatus: string, status: string) => ({
      botInfo: { id: 42 },
      userSocial: { id: 1 },
      conversation: { isLeaved: oldStatus === 'left' },
      myChatMember: {
        chat: { id: -1001, type: 'group', title: 'Расписание' },
        old_chat_member: { status: oldStatus },
        new_chat_member: { status, user: { id: 42 } },
      },
      replyWithHTML: jest.fn(),
      i18n: { t: jest.fn().mockReturnValue('start') },
      sessionConversation: {},
      state: { appeal: false },
    });
    const getStart = jest.fn();
    const parseChatTitle = jest.fn();
    (update as any).keyboardFactory.getStart = getStart;
    (update as any).keyboardFactory.getSelectGroupInline = jest.fn();
    (update as any).telegramService.parseChatTitle = parseChatTitle;

    await update.onMyChatMember(
      createContext('member', 'administrator') as any,
    );

    expect(getStart).not.toHaveBeenCalled();
    expect(parseChatTitle).not.toHaveBeenCalled();

    await update.onMyChatMember(createContext('left', 'member') as any);

    expect(getStart).toHaveBeenCalledTimes(1);
    expect(parseChatTitle).toHaveBeenCalledTimes(1);
  });
});
