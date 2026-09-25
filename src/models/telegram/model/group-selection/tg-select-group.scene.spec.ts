import { TgSelectGroupScene } from './tg-select-group.scene';

describe('TgSelectGroupScene', () => {
  it('saves a group selected by an authorized group-chat callback', async () => {
    const scheduleKeyboardFactory = {
      getScheduleInline: jest.fn().mockReturnValue('schedule keyboard'),
    };
    const scheduleService = {
      resolveGroupName: jest.fn().mockReturnValue('ЦИС-17'),
    };
    const scene = new TgSelectGroupScene(
      {} as any,
      {} as any,
      scheduleKeyboardFactory as any,
      scheduleService as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      chat: { type: 'group' },
      callbackQuery: { data: 'selectGroup:ЦИС-17' },
      state: { appeal: false },
      scene: {
        state: { groupName: 'ЦИС-17', firstTime: false },
        leave: jest.fn(),
      },
      conversation: { groupName: 'ЦИС-11' },
      userSocial: {},
      i18n: { t: jest.fn().mockReturnValue('Группа выбрана') },
      replyWithHTML: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(ctx.conversation.groupName).toBe('ЦИС-17');
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'Группа выбрана',
      'schedule keyboard',
    );
  });

  it('restores the private reply keyboard after sending the schedule shortcuts', async () => {
    const baseKeyboardFactory = {
      getStart: jest.fn().mockReturnValue('start keyboard'),
    };
    const scheduleKeyboardFactory = {
      getScheduleInline: jest.fn().mockReturnValue('schedule keyboard'),
    };
    const telegramService = {
      isAdmin: jest.fn().mockReturnValue(false),
      syncPrivateChatCommands: jest.fn(),
    };
    const scene = new TgSelectGroupScene(
      baseKeyboardFactory as any,
      {} as any,
      scheduleKeyboardFactory as any,
      {
        resolveGroupName: jest.fn().mockReturnValue('ЦИС-17'),
      } as any,
      telegramService as any,
      {} as any,
    );
    const ctx = {
      chat: { id: 1, type: 'private' },
      from: { id: 1 },
      session: {},
      user: null,
      userSocial: {},
      state: {},
      scene: {
        state: { groupName: 'ЦИС-17', firstTime: false },
        leave: jest.fn(),
      },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(ctx.replyWithHTML).toHaveBeenNthCalledWith(
      1,
      'page.select_group.selected',
      'schedule keyboard',
    );
    expect(ctx.replyWithHTML).toHaveBeenNthCalledWith(
      2,
      'page.select_group.keyboard_updated',
      'start keyboard',
    );
  });

  it('shows the current personal group in the initial prompt', async () => {
    const scene = new TgSelectGroupScene(
      {} as any,
      { getSelectGroupPrompt: jest.fn().mockReturnValue({}) } as any,
      {} as any,
      { randomGroupName: 'ЦИС-11' } as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      chat: { type: 'private' },
      scene: { state: {}, leave: jest.fn() },
      userSocial: { groupName: 'ЦИС-21' },
      user: null,
      state: {},
      i18n: {
        t: jest.fn((phrase) =>
          phrase === 'page.select_group.current'
            ? 'Сейчас указана группа: ЦИС-21'
            : 'Напиши название группы',
        ),
      },
      replyWithHTML: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'Сейчас указана группа: ЦИС-21\n\nНапиши название группы',
      expect.anything(),
    );
  });

  it('sends a new initial prompt for a protected callback message', async () => {
    const scene = new TgSelectGroupScene(
      {} as any,
      { getSelectGroupPrompt: jest.fn().mockReturnValue({}) } as any,
      {} as any,
      { randomGroupName: 'ЦИС-11' } as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      chat: { type: 'private' },
      callbackQuery: { data: 'broadcast:action:15:select_group' },
      scene: {
        state: { forceNewMessage: true },
        leave: jest.fn(),
      },
      userSocial: {},
      user: null,
      state: {},
      i18n: { t: jest.fn().mockReturnValue('Напиши название группы') },
      editMessageText: jest.fn(),
      replyWithHTML: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.replyWithHTML).toHaveBeenCalled();
  });
});
