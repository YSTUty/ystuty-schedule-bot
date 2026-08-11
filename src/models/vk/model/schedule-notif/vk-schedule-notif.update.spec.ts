import { LocalePhrase } from '@my-interfaces';

import { VkScheduleNotifUpdate } from './vk-schedule-notif.update';

describe('VkScheduleNotifUpdate', () => {
  it('shows the notif group before confirming deletion', async () => {
    const notifService = {
      getFirstNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetId: 'ЦИС-11',
      }),
    };
    const keyboardFactory = {
      getScheduleNotifDeleteConfirmation: jest
        .fn()
        .mockReturnValue({ inline: () => ({}) }),
    };
    const update = new VkScheduleNotifUpdate(
      notifService as any,
      keyboardFactory as any,
    );
    const t = jest.fn().mockReturnValue('confirm delete');
    const ctx = {
      eventPayload: { scheduleNotifAction: 'deleteConfirm', notifId: 7 },
      isDM: true,
      state: { userSocial: { id: 1 } },
      i18n: { t },
      editMessage: jest.fn(),
    };

    await update.onMessageEvent(ctx as any, jest.fn());

    expect(t).toHaveBeenCalledWith(
      LocalePhrase.Page_ScheduleNotif_ConfirmDelete,
      { groupName: 'ЦИС-11' },
    );
  });
});
