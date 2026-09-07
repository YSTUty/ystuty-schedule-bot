import { LocalePhrase } from '@my-interfaces';

import {
  createGroupScheduleActionRegExp,
  createGroupScheduleWeekNavigationActionRegExp,
  ScheduleUpdate,
} from './schedule.update';

describe('Telegram ScheduleUpdate', () => {
  it('matches a callback with a nonstandard long group name', () => {
    const match = createGroupScheduleActionRegExp(
      LocalePhrase.Button_Schedule_ForWeek,
    ).exec('button.schedule.for_week:Научно-исслед сем');

    expect(match?.groups).toMatchObject({
      phrase: 'button.schedule.for_week',
      groupTarget: 'Научно-исслед сем',
    });
  });

  it('matches a hashed group target in a week navigation callback', () => {
    const match = createGroupScheduleWeekNavigationActionRegExp(
      LocalePhrase.Button_Schedule_NextWeek,
    ).exec('button.schedule.next_week:g:1a2b3c4d5e6f:week:4');

    expect(match?.groups).toMatchObject({
      groupTarget: 'g:1a2b3c4d5e6f',
      weekNumber: '4',
    });
  });

  const createUpdate = () => {
    const scheduleService = {
      getGroupByName: jest.fn((groupName) => groupName),
      groupNameByHash: jest.fn(),
      parseGroupName: jest.fn(),
      findNext: jest.fn(),
      getScheduleWeekView: jest.fn(),
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

  it('resolves a hashed group callback target', () => {
    const { update, scheduleService } = createUpdate();
    scheduleService.groupNameByHash.mockReturnValue('Научно-исслед сем');
    const ctx = {
      chat: { type: 'private' },
      userSocial: { groupName: null },
    } as any;

    const groupName = (update as any).resolveGroupName(ctx, 'g:1a2b3c4d5e6f');

    expect(groupName).toBe('Научно-исслед сем');
    expect(scheduleService.groupNameByHash).toHaveBeenCalledWith(
      '1a2b3c4d5e6f',
    );
    expect(scheduleService.getGroupByName).not.toHaveBeenCalled();
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

  it('shows neighboring available weeks and a relative title for a group', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T09:00:00.000Z'));

    try {
      const { update, scheduleService } = createUpdate();
      const weekView = {
        weekNumber: 3,
        weekStartDate: new Date('2026-09-21T00:00:00.000Z'),
        dateRange: '21–27 сентября',
        message: '#НПн',
        previousWeekNumber: 2,
      };
      scheduleService.getScheduleWeekView.mockResolvedValue(weekView);
      const keyboardFactory = {
        getScheduleInline: jest.fn(() => ({})),
      };
      (update as any).keyboardFactory = keyboardFactory;
      const ctx = {
        chat: { type: 'private' },
        callbackQuery: {},
        userSocial: { groupName: 'ЦИС-46' },
        match: { groups: { groupName: 'ЦИС-46', weekNumber: '3' } },
        scene: { enter: jest.fn() },
        editMessageText: jest.fn(),
        answerCbQuery: jest.fn(),
        i18n: { t: jest.fn((phrase) => phrase) },
      } as any;

      await update.hearSchedul_Week(ctx);

      expect(scheduleService.getScheduleWeekView).toHaveBeenCalledWith({
        targetId: 'ЦИС-46',
        targetType: 'group',
        requestedWeekNumber: 3,
        withTags: true,
        presentation: 'compact',
      });
      expect(ctx.i18n.t).toHaveBeenCalledWith('page.schedule.week_title', {
        weekNumber: 3,
        dateRange: '21–27 сентября',
        isNextWeek: false,
        weekTitle: 'page.schedule.week_title_future',
      });
      expect(keyboardFactory.getScheduleInline).toHaveBeenCalledWith(
        ctx,
        { type: 'group', id: 'ЦИС-46' },
        weekView,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
