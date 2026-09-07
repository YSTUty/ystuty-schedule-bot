import { ScheduleUpdate, vkScheduleWeekTextPhrases } from './schedule.update';

describe('VK ScheduleUpdate', () => {
  it('does not register dynamic week navigation labels as text commands', () => {
    expect(vkScheduleWeekTextPhrases).not.toContain(
      'button.schedule.previous_week',
    );
    expect(vkScheduleWeekTextPhrases).not.toContain(
      'button.schedule.next_week',
    );
  });

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
        getScheduleWeekView: jest.fn().mockResolvedValue(null),
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

      await update.onScheduleWeekNavigation(ctx);

      expect(ctx.send).toHaveBeenCalledWith(
        'Нет расписания: 7–13 сентября\n\n[ЦИС-46]',
        { keyboard: {} },
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows neighboring available weeks for a teacher from inline payload', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T09:00:00.000Z'));

    try {
      const weekView = {
        weekNumber: 3,
        weekStartDate: new Date('2026-09-21T00:00:00.000Z'),
        dateRange: '21–27 сентября',
        message: '#НПн',
        previousWeekNumber: 2,
      };
      const scheduleService = {
        getTeacher: jest.fn(() => ({ id: 42, name: 'Иванов И. И.' })),
        getScheduleWeekView: jest.fn().mockResolvedValue(weekView),
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
        text: '',
        messagePayload: {
          phrase: 'button.schedule.next_week',
          teacherId: 42,
          weekNumber: 3,
        },
        state: { userSocial: { groupName: 'ЦИС-46' } },
        $match: { groups: {} },
        setActivity: jest.fn(),
        send: jest.fn(),
        scene: { enter: jest.fn() },
        i18n: { t: jest.fn((phrase) => phrase) },
      } as any;

      await update.onScheduleWeekNavigation(ctx);

      expect(scheduleService.getScheduleWeekView).toHaveBeenCalledWith({
        targetId: 42,
        targetType: 'teacher',
        requestedWeekNumber: 3,
        presentation: 'compact',
      });
      expect(keyboardFactory.getSchedule).toHaveBeenCalledWith(
        ctx,
        { type: 'teacher', id: 42 },
        weekView,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('handles a week navigation callback and replaces its source message', async () => {
    const weekView = {
      weekNumber: 3,
      weekStartDate: new Date('2026-09-21T00:00:00.000Z'),
      dateRange: '21–27 сентября',
      message: '#НПн',
      nextWeekNumber: 4,
    };
    const scheduleService = {
      getTeacher: jest.fn(() => ({ id: 42, name: 'Иванов И. И.' })),
      getScheduleWeekView: jest.fn().mockResolvedValue(weekView),
    };
    const keyboard = {};
    const keyboardFactory = {
      getSchedule: jest.fn(() => ({ inline: jest.fn(() => keyboard) })),
    };
    const update = new ScheduleUpdate(
      scheduleService as any,
      keyboardFactory as any,
    );
    const ctx = {
      isChat: false,
      eventPayload: {
        phrase: 'button.schedule.next_week',
        teacherId: 42,
        weekNumber: 3,
      },
      state: { userSocial: { groupName: 'ЦИС-46' } },
      $match: { groups: {} },
      answer: jest.fn(),
      editMessage: jest.fn(),
      send: jest.fn(),
      scene: { enter: jest.fn() },
      isMessageEventContext: jest.fn(() => true),
      i18n: { t: jest.fn((phrase) => phrase) },
    } as any;

    await update.onScheduleWeekNavigation(ctx);

    // expect(ctx.answer).toHaveBeenCalledWith({
    //   type: 'show_snackbar',
    //   text: 'Открываю неделю',
    // });
    expect(ctx.editMessage).toHaveBeenCalledWith(
      expect.objectContaining({ keyboard }),
    );
    expect(ctx.send).not.toHaveBeenCalled();
  });
});
