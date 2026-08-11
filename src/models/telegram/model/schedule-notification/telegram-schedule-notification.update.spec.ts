import { LocalePhrase } from '@my-interfaces';

import { TelegramScheduleNotificationUpdate } from './telegram-schedule-notification.update';

describe('TelegramScheduleNotificationUpdate', () => {
  it('shows the notification group before confirming deletion', async () => {
    const notificationService = {
      getFirstNotification: jest.fn().mockResolvedValue({
        id: 7,
        targetId: 'ЦИС-11',
      }),
    };
    const keyboardFactory = {
      getScheduleNotificationDeleteConfirmation: jest.fn().mockReturnValue({}),
    };
    const update = new TelegramScheduleNotificationUpdate(
      notificationService as any,
      keyboardFactory as any,
    );
    const t = jest.fn().mockReturnValue('confirm delete');
    const ctx = {
      chat: { type: 'private' },
      match: { groups: { action: 'deleteConfirm', params: '7' } },
      userSocial: { id: 1 },
      i18n: { t },
      tryAnswerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
    };

    await update.onAction(ctx as any);

    expect(t).toHaveBeenCalledWith(
      LocalePhrase.Page_ScheduleNotification_ConfirmDelete,
      { groupName: 'ЦИС-11' },
    );
  });
});
