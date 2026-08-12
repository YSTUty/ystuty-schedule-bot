import { TgScheduleNotifGroupScene } from './tg-schedule-notif-group.scene';

describe('TgScheduleNotifGroupScene', () => {
  it('returns a conversation notif picker callback to the conversation editor', async () => {
    const notifService = {
      changeConversationGroup: jest.fn().mockResolvedValue(true),
      getFirstConversationNotif: jest.fn().mockResolvedValue({
        id: 7,
        weekdays: [1, 2, 3],
      }),
      getFirstNotif: jest.fn().mockResolvedValue(null),
    };
    const ystutyService = {
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
      ystutyService as any,
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
    expect(notifService.getFirstConversationNotif).toHaveBeenCalledWith(3);
    expect(notifService.getFirstNotif).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      'Настройки рассылки',
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });
});
