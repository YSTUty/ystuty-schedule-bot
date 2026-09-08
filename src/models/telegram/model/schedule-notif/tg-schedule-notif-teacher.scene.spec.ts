import { TgScheduleNotifTeacherScene } from './tg-schedule-notif-teacher.scene';

describe('TgScheduleNotifTeacherScene', () => {
  it('creates a teacher notification from a draft without changing the profile teacher', async () => {
    const notifService = {
      createForUserSocial: jest.fn().mockResolvedValue({ id: 7 }),
      getNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetId: '42',
        deliveryHour: 8,
        deliveryMinute: 30,
        period: 'day',
        targetDayOffset: 0,
        weekdays: [1],
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
      getTeacher: jest.fn().mockReturnValue({ id: 42 }),
      getTeacherName: jest.fn().mockReturnValue('Иванов И. И.'),
    };
    const keyboardFactory = {
      getScheduleNotifEditor: jest.fn().mockReturnValue({ reply_markup: {} }),
    };
    const scene = new TgScheduleNotifTeacherScene(
      notifService as any,
      draftService as any,
      scheduleService as any,
      keyboardFactory as any,
    );
    const ctx = {
      callbackQuery: { data: 'sched-notif-teacher:select:42' },
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
      { type: 'teacher', id: '42' },
      expect.objectContaining({ deliveryHour: 8, deliveryMinute: 30 }),
    );
    expect(notifService.getNotif).toHaveBeenCalledWith(2, 7);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Иванов И. И.'),
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });
});
