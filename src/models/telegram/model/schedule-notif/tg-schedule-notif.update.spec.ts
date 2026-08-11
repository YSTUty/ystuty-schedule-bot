import { LocalePhrase } from '@my-interfaces';

import { TgScheduleNotifUpdate } from './tg-schedule-notif.update';

describe('TgScheduleNotifUpdate', () => {
  it('shows the notif group before confirming deletion', async () => {
    const notifService = {
      getFirstNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetId: 'ЦИС-11',
      }),
    };
    const keyboardFactory = {
      getScheduleNotifDeleteConfirmation: jest.fn().mockReturnValue({}),
    };
    const update = new TgScheduleNotifUpdate(
      notifService as any,
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
      LocalePhrase.Page_ScheduleNotif_ConfirmDelete,
      { groupName: 'ЦИС-11' },
    );
  });
});
