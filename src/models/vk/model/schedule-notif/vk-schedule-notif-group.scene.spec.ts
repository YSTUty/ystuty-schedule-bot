import { VkScheduleNotifGroupScene } from './vk-schedule-notif-group.scene';

describe('VkScheduleNotifGroupScene', () => {
  it('renders institutes once when the scene first receives the source callback', async () => {
    const groupPicker = {
      renderInstitutes: jest.fn().mockReturnValue({
        text: 'Институты',
        keyboard: { inline: jest.fn() },
      }),
      renderGroups: jest.fn(),
    };
    const scene = new VkScheduleNotifGroupScene(
      {} as any,
      groupPicker as any,
      {} as any,
      {
        getScheduleNotifGroupPickerCancelButton: jest.fn(),
      } as any,
    );
    const ctx = {
      eventPayload: { scheduleNotifAction: 'changeGroup' },
      scene: {
        state: { notifId: 7 },
        step: { firstTime: true },
      },
      api: { messages: { edit: jest.fn() } },
      peerId: 1,
      conversationMessageId: 2,
      isMessageEventContext: jest.fn().mockReturnValue(true),
      editMessage: jest.fn(),
    } as any;

    await scene.step(ctx);

    expect(groupPicker.renderInstitutes).toHaveBeenCalledTimes(1);
    expect(groupPicker.renderGroups).not.toHaveBeenCalled();
  });

  it('renders only the requested group page from a group pager callback', async () => {
    const groupPicker = {
      renderInstitutes: jest.fn(),
      renderGroups: jest.fn().mockReturnValue({
        text: 'Группы',
        keyboard: { inline: jest.fn() },
      }),
    };
    const keyboardFactory = {
      getPagination: jest.fn().mockReturnValue({ inline: jest.fn() }),
      getInstitutesListButton: jest.fn(),
      getScheduleNotifGroupPickerCancelButton: jest.fn(),
    };
    const scene = new VkScheduleNotifGroupScene(
      {} as any,
      groupPicker as any,
      {} as any,
      keyboardFactory as any,
    );
    const ctx = {
      eventPayload: {
        scheduleNotifGroupAction: 'groupsPage',
        instituteHash: 'institute-hash',
        page: 2,
      },
      scene: {
        state: { notifId: 7 },
        step: { firstTime: false },
      },
      i18n: { t: jest.fn().mockReturnValue('Группы') },
      api: { messages: { edit: jest.fn() } },
      peerId: 1,
      conversationMessageId: 2,
      isMessageEventContext: jest.fn().mockReturnValue(true),
      editMessage: jest.fn(),
    } as any;

    await scene.step(ctx);

    expect(groupPicker.renderGroups).toHaveBeenCalledWith(
      ctx,
      'institute-hash',
      2,
      expect.any(Object),
    );
    expect(groupPicker.renderInstitutes).not.toHaveBeenCalled();
  });

  it('extracts a group name from manual input before changing the notif', async () => {
    const notifService = {
      changeGroup: jest.fn().mockResolvedValue(true),
      getFirstNotif: jest.fn().mockResolvedValue(null),
    };
    const scheduleService = {
      getGroupByName: jest.fn().mockReturnValue(undefined),
      parseGroupName: jest.fn().mockReturnValue('ЦИС-18'),
    };
    const scene = new VkScheduleNotifGroupScene(
      notifService as any,
      {} as any,
      scheduleService as any,
      { getScheduleNotifEditor: jest.fn() } as any,
    );
    const ctx = {
      isDM: true,
      text: 'группа цис-18',
      eventPayload: {},
      scene: {
        state: { notifId: 7 },
        step: { firstTime: false },
        leave: jest.fn(),
      },
      state: { userSocial: { id: 1 } },
      isMessageEventContext: jest.fn().mockReturnValue(false),
    } as any;

    await scene.step(ctx);

    expect(scheduleService.parseGroupName).toHaveBeenCalledWith(
      'группа цис-18',
    );
    expect(notifService.changeGroup).toHaveBeenCalledWith(1, 7, 'ЦИС-18');
  });

  it('returns a conversation notif picker callback to the conversation editor', async () => {
    const notifService = {
      changeConversationGroup: jest.fn().mockResolvedValue(true),
      getFirstConversationNotif: jest.fn().mockResolvedValue({
        id: 7,
        weekdays: [1, 2, 3],
      }),
      getFirstNotif: jest.fn().mockResolvedValue(null),
    };
    const scheduleService = {
      getGroupByName: jest.fn().mockReturnValue('ЦИС-11'),
      parseGroupName: jest.fn(),
    };
    const scene = new VkScheduleNotifGroupScene(
      notifService as any,
      {} as any,
      scheduleService as any,
      {
        getScheduleNotifEditor: jest
          .fn()
          .mockReturnValue({ inline: jest.fn() }),
      } as any,
    );
    const ctx = {
      isDM: false,
      eventPayload: {
        scheduleNotifGroupAction: 'select',
        groupName: 'ЦИС-11',
      },
      scene: {
        state: { notifId: 7 },
        step: { firstTime: false },
        leave: jest.fn(async () => {
          ctx.scene.state = {} as any;
        }),
      },
      state: {
        conversation: { id: 3 },
        userSocial: { id: 1 },
      },
      i18n: { t: jest.fn().mockReturnValue('Настройки рассылки') },
      isMessageEventContext: jest.fn().mockReturnValue(true),
      answer: jest.fn(),
      editMessage: jest.fn(),
    } as any;

    await scene.step(ctx);

    expect(notifService.changeConversationGroup).toHaveBeenCalledWith(
      3,
      7,
      'ЦИС-11',
    );
    expect(notifService.getFirstConversationNotif).toHaveBeenCalledWith(3);
    expect(notifService.getFirstNotif).not.toHaveBeenCalled();
    expect(ctx.editMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Настройки рассылки' }),
    );
  });
});
