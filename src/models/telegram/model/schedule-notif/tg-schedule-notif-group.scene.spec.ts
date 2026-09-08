import { TgScheduleNotifGroupScene } from './tg-schedule-notif-group.scene';

describe('TgScheduleNotifGroupScene', () => {
  it('opens the institute picker when entering the scene', async () => {
    const groupPicker = {
      renderInstitutes: jest.fn().mockReturnValue({
        text: 'Выбери институт',
        keyboard: { reply_markup: {} },
      }),
    };
    const scene = new TgScheduleNotifGroupScene(
      {} as any,
      {} as any,
      groupPicker as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      callbackQuery: { data: 'scheduleNotif:createTarget:0123456789ab:group' },
      scene: { state: { draftId: '0123456789ab' } },
      i18n: { t: jest.fn().mockReturnValue('Назад') },
      editMessageText: jest.fn(),
      tryAnswerCbQuery: jest.fn(),
    };

    await scene.onEnter(ctx as any);

    expect(groupPicker.renderInstitutes).toHaveBeenCalledWith(
      ctx,
      1,
      expect.objectContaining({
        prefix: 'sched-notif-group:',
        pagerName: 'sched-notif:institutes',
      }),
    );
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      'Выбери институт',
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });

  it('creates a group notification from a draft selected in the picker', async () => {
    const notifService = {
      createForUserSocial: jest.fn().mockResolvedValue({ id: 7 }),
      getNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetId: 'ЦИС-11',
        deliveryHour: 8,
        deliveryMinute: 30,
        period: 'day',
        targetDayOffset: 0,
        weekdays: [1],
        isEnabled: true,
      }),
    };
    const draftService = {
      consume: jest.fn().mockResolvedValue({
        userSocialId: 2,
        settings: {
          deliveryHour: 8,
          deliveryMinute: 30,
          period: 'day',
          targetDayOffset: 0,
          weekdays: [1],
        },
      }),
    };
    const scheduleService = {
      groupNameByHash: jest.fn().mockReturnValue('ЦИС-11'),
      getGroupByName: jest.fn().mockReturnValue('ЦИС-11'),
      parseGroupName: jest.fn(),
    };
    const keyboardFactory = {
      getScheduleNotifEditor: jest.fn().mockReturnValue({ reply_markup: {} }),
    };
    const scene = new TgScheduleNotifGroupScene(
      notifService as any,
      draftService as any,
      {} as any,
      scheduleService as any,
      keyboardFactory as any,
    );
    const ctx = {
      callbackQuery: { data: 'sched-notif-group:select:group-hash' },
      chat: { id: 10, type: 'private' },
      from: { id: 5 },
      userSocial: { id: 2 },
      scene: {
        state: { draftId: '0123456789ab' },
        leave: jest.fn(async () => {
          ctx.scene.state = {} as any;
        }),
      },
      i18n: { t: jest.fn().mockReturnValue('Рассылка сохранена') },
      tryAnswerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
    };

    await scene.step(ctx as any);

    expect(draftService.consume).toHaveBeenCalledWith('0123456789ab', {
      transport: 'telegram',
      ownerId: 5,
      peerId: 10,
    });
    expect(notifService.createForUserSocial).toHaveBeenCalledWith(
      ctx.userSocial,
      { type: 'group', id: 'ЦИС-11' },
      expect.objectContaining({ deliveryHour: 8, deliveryMinute: 30 }),
    );
    expect(notifService.getNotif).toHaveBeenCalledWith(2, 7);
  });

  it('creates a group notification for a conversation from its draft', async () => {
    const notifService = {
      createForConversation: jest.fn().mockResolvedValue({ id: 7 }),
      getConversationNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetId: 'ЦИС-11',
        deliveryHour: 8,
        deliveryMinute: 30,
        period: 'day',
        targetDayOffset: 0,
        weekdays: [1],
        isEnabled: true,
      }),
    };
    const draftService = {
      consume: jest.fn().mockResolvedValue({
        userSocialId: 2,
        settings: {
          deliveryHour: 8,
          deliveryMinute: 30,
          period: 'day',
          targetDayOffset: 0,
          weekdays: [1],
        },
      }),
    };
    const scene = new TgScheduleNotifGroupScene(
      notifService as any,
      draftService as any,
      {} as any,
      {
        groupNameByHash: jest.fn().mockReturnValue('ЦИС-11'),
        getGroupByName: jest.fn().mockReturnValue('ЦИС-11'),
        parseGroupName: jest.fn(),
      } as any,
      {
        getScheduleNotifEditor: jest.fn().mockReturnValue({ reply_markup: {} }),
      } as any,
    );
    const ctx = {
      callbackQuery: { data: 'sched-notif-group:select:group-hash' },
      chat: { id: -10, type: 'group' },
      from: { id: 5 },
      conversation: { id: 3 },
      userSocial: { id: 2 },
      scene: { state: { draftId: '0123456789ab' }, leave: jest.fn() },
      i18n: { t: jest.fn().mockReturnValue('Рассылка сохранена') },
      tryAnswerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
    };

    await scene.step(ctx as any);

    expect(notifService.createForConversation).toHaveBeenCalledWith(
      ctx.conversation,
      { type: 'group', id: 'ЦИС-11' },
      expect.objectContaining({ deliveryHour: 8 }),
    );
    expect(notifService.getConversationNotif).toHaveBeenCalledWith(3, 7);
  });

  it('returns a conversation notif picker callback to the conversation editor', async () => {
    const notifService = {
      changeConversationGroup: jest.fn().mockResolvedValue(true),
      getConversationNotif: jest.fn().mockResolvedValue({
        id: 7,
        weekdays: [1, 2, 3],
      }),
      getFirstNotif: jest.fn().mockResolvedValue(null),
    };
    const scheduleService = {
      groupNameByHash: jest.fn().mockReturnValue('ЦИС-11'),
      getGroupByName: jest.fn().mockReturnValue('ЦИС-11'),
      parseGroupName: jest.fn(),
    };
    const keyboardFactory = {
      getScheduleNotifEditor: jest.fn().mockReturnValue({ reply_markup: {} }),
    };
    const scene = new TgScheduleNotifGroupScene(
      notifService as any,
      {} as any,
      {} as any,
      scheduleService as any,
      keyboardFactory as any,
    );
    const ctx = {
      callbackQuery: { data: 'sched-notif-group:select:group-hash' },
      chat: { type: 'supergroup' },
      conversation: { id: 3 },
      userSocial: { id: 1 },
      scene: {
        state: { notifId: 7 },
        leave: jest.fn(async () => {
          ctx.scene.state = {} as any;
        }),
      },
      i18n: { t: jest.fn().mockReturnValue('Настройки рассылки') },
      tryAnswerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
    };

    await scene.step(ctx as any);

    expect(notifService.changeConversationGroup).toHaveBeenCalledWith(
      3,
      7,
      'ЦИС-11',
    );
    expect(notifService.getConversationNotif).toHaveBeenCalledWith(3, 7);
    expect(notifService.getFirstNotif).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      'Настройки рассылки',
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });
});
