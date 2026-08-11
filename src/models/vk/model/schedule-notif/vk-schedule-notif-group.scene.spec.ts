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
    const ystutyService = {
      getGroupByName: jest.fn().mockReturnValue(undefined),
      parseGroupName: jest.fn().mockReturnValue('ЦИС-18'),
    };
    const scene = new VkScheduleNotifGroupScene(
      notifService as any,
      {} as any,
      ystutyService as any,
      { getScheduleNotifEditor: jest.fn() } as any,
    );
    const ctx = {
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

    expect(ystutyService.parseGroupName).toHaveBeenCalledWith('группа цис-18');
    expect(notifService.changeGroup).toHaveBeenCalledWith(1, 7, 'ЦИС-18');
  });
});
