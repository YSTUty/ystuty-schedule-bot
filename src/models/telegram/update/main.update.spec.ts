import { TG_ALLOWED_CHAT_TYPES_KEY } from '@my-common/decorator/tg';

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
});
