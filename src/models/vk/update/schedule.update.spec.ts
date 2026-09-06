import { ScheduleUpdate } from './schedule.update';

describe('VK ScheduleUpdate', () => {
  it('uses the persistent conversation group for a chat schedule', async () => {
    const scheduleService = {
      getGroupByName: jest.fn((groupName) => groupName),
      parseGroupName: jest.fn(),
    };
    const update = new ScheduleUpdate(scheduleService as any, {} as any);
    const ctx = {
      isChat: true,
      state: {
        conversation: { groupName: 'ЦИС-21' },
        userSocial: { groupName: 'ЦИС-11' },
      },
      sessionConversation: {},
      $match: { groups: {} },
      scene: { enter: jest.fn() },
      send: jest.fn(),
    } as any;

    const target = await (update as any).resolveScheduleTarget(
      ctx,
      undefined,
      false,
    );

    expect(target).toEqual({ id: 'ЦИС-21', type: 'group', name: 'ЦИС-21' });
    expect(scheduleService.getGroupByName).toHaveBeenCalledWith('ЦИС-21');
    expect(ctx.scene.enter).not.toHaveBeenCalled();
  });

  it('names the requested week range when the schedule is unavailable', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T09:00:00.000Z'));

    try {
      const scheduleService = {
        getGroupByName: jest.fn((groupName) => groupName),
        parseGroupName: jest.fn(),
        findNext: jest.fn().mockResolvedValue([1, null]),
      };
      const keyboardFactory = {
        getSchedule: jest.fn(() => ({ inline: jest.fn(() => ({})) })),
      };
      const update = new ScheduleUpdate(
        scheduleService as any,
        keyboardFactory as any,
      );
      const ctx = {
        isChat: false,
        state: { userSocial: { groupName: 'ЦИС-46' } },
        $match: { groups: {} },
        setActivity: jest.fn(),
        send: jest.fn(),
        scene: { enter: jest.fn() },
        i18n: {
          t: jest.fn((_phrase, data) => `Нет расписания: ${data.dateRange}`),
        },
      } as any;

      await update.hearSchedul_Week(ctx);

      expect(ctx.send).toHaveBeenCalledWith(
        'Нет расписания: 7–13 сентября\n\n[ЦИС-46]',
        { keyboard: {} },
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
