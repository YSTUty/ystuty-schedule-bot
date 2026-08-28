import { LocalePhrase } from '@my-interfaces';

import { TgScheduleNotifUpdate } from './tg-schedule-notif.update';

describe('TgScheduleNotifUpdate', () => {
  it('acknowledges the welcome-card notification callback', async () => {
    const update = new TgScheduleNotifUpdate({} as any, {} as any, {} as any);
    (update as any).openSettings = jest.fn();
    const ctx = {
      updateType: 'callback_query',
      chat: { type: 'private' },
      tryAnswerCbQuery: jest.fn(),
    };

    await update.openFromMenu(ctx as any);

    expect(ctx.tryAnswerCbQuery).toHaveBeenCalledTimes(1);
    expect((update as any).openSettings).toHaveBeenCalledWith(ctx);
  });

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
      {} as any,
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

  it('checks conversation admin via cached telegram service admins', async () => {
    const telegramService = {
      getCachedChatAdmins: jest
        .fn()
        .mockResolvedValue([{ user: { id: 5 }, status: 'administrator' }]),
    };
    const update = new TgScheduleNotifUpdate(
      {} as any,
      {} as any,
      telegramService as any,
    );
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      conversation: { invitedByUserSocialId: 2 },
      from: { id: 5 },
      userSocial: { id: 1 },
    };

    await expect((update as any).canManage(ctx)).resolves.toBe(true);
    expect(telegramService.getCachedChatAdmins).toHaveBeenCalledWith(-1001);
  });
});
