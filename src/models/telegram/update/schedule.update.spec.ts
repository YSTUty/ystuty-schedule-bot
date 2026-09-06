import { ScheduleUpdate } from './schedule.update';

describe('Telegram ScheduleUpdate', () => {
  const createUpdate = () => {
    const scheduleService = {
      getGroupByName: jest.fn((groupName) => groupName),
      parseGroupName: jest.fn(),
      findNext: jest.fn(),
    };

    return {
      update: new ScheduleUpdate({} as any, scheduleService as any),
      scheduleService,
    };
  };

  it('uses the persistent conversation group for a group chat schedule', async () => {
    const { update, scheduleService } = createUpdate();
    const ctx = {
      chat: { type: 'group' },
      conversation: { groupName: 'ЦИС-21' },
      sessionConversation: {},
      userSocial: { groupName: 'ЦИС-11' },
      match: { groups: {} },
      scene: { enter: jest.fn() },
      replyWithHTML: jest.fn(),
    } as any;

    await (update as any).resolveGroupName(ctx);

    expect(scheduleService.getGroupByName).toHaveBeenCalledWith('ЦИС-21');
    expect(ctx.scene.enter).not.toHaveBeenCalled();
  });

  it('names the requested date when the daily schedule is unavailable', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T09:00:00.000Z'));

    try {
      const { update, scheduleService } = createUpdate();
      scheduleService.findNext.mockResolvedValue([0, null]);
      const ctx = {
        chat: { type: 'private' },
        userSocial: { groupName: 'ЦИС-46' },
        match: { groups: {} },
        scene: { enter: jest.fn() },
        sendChatAction: jest.fn(),
        replyWithHTML: jest.fn(),
        i18n: {
          t: jest.fn((_phrase, data) => `Нет расписания: ${data.date}`),
        },
      } as any;
      const keyboardFactory = {
        getScheduleInline: jest.fn(() => ({})),
      };
      (update as any).keyboardFactory = keyboardFactory;

      await update.hearSchedul_OneDay(ctx);

      expect(ctx.replyWithHTML).toHaveBeenCalledWith(
        'Нет расписания: 7 сентября\n\n[ЦИС-46]',
        {},
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
