import { VkScheduleNotificationGroupScene } from './vk-schedule-notification-group.scene';

describe('VkScheduleNotificationGroupScene', () => {
  it('renders institutes once when the scene first receives the source callback', async () => {
    const groupPicker = {
      renderInstitutes: jest.fn().mockReturnValue({
        text: 'Институты',
        keyboard: { inline: jest.fn() },
      }),
      renderGroups: jest.fn(),
    };
    const scene = new VkScheduleNotificationGroupScene(
      {} as any,
      groupPicker as any,
      {} as any,
      {
        getScheduleNotificationGroupPickerCancelButton: jest.fn(),
      } as any,
    );
    const ctx = {
      eventPayload: { scheduleNotifAction: 'changeGroup' },
      scene: {
        state: { notificationId: 7 },
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
      getScheduleNotificationGroupPickerCancelButton: jest.fn(),
    };
    const scene = new VkScheduleNotificationGroupScene(
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
        state: { notificationId: 7 },
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
});
