import { LocalePhrase } from '@my-interfaces';

import { VkScheduleNotificationUpdate } from './vk-schedule-notification.update';

describe('VkScheduleNotificationUpdate', () => {
  it('shows the notification group before confirming deletion', async () => {
    const notificationService = {
      getFirstNotification: jest.fn().mockResolvedValue({
        id: 7,
        targetId: 'ЦИС-11',
      }),
    };
    const keyboardFactory = {
      getScheduleNotificationDeleteConfirmation: jest
        .fn()
        .mockReturnValue({ inline: () => ({}) }),
    };
    const update = new VkScheduleNotificationUpdate(
      notificationService as any,
      keyboardFactory as any,
    );
    const t = jest.fn().mockReturnValue('confirm delete');
    const ctx = {
      eventPayload: { scheduleNotifAction: 'deleteConfirm', notificationId: 7 },
      isDM: true,
      state: { userSocial: { id: 1 } },
      i18n: { t },
      editMessage: jest.fn(),
    };

    await update.onMessageEvent(ctx as any, jest.fn());

    expect(t).toHaveBeenCalledWith(
      LocalePhrase.Page_ScheduleNotification_ConfirmDelete,
      { groupName: 'ЦИС-11' },
    );
  });
});
