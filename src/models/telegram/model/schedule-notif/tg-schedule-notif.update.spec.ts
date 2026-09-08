import { TelegramError } from 'telegraf-hardened';

import { LocalePhrase } from '@my-interfaces';

import { TgScheduleNotifUpdate } from './tg-schedule-notif.update';

describe('TgScheduleNotifUpdate', () => {
  it('acknowledges the welcome-card notification callback', async () => {
    const update = new TgScheduleNotifUpdate(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
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
      getNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetType: 'group',
        targetId: 'ЦИС-11',
      }),
    };
    const keyboardFactory = {
      getScheduleNotifDeleteConfirmation: jest.fn().mockReturnValue({}),
    };
    const update = new TgScheduleNotifUpdate(
      notifService as any,
      {} as any,
      { getTeacherName: jest.fn() } as any,
      keyboardFactory as any,
      {} as any,
    );
    const t = jest.fn().mockReturnValue('confirm delete');
    const ctx = {
      chat: { type: 'private' },
      match: { groups: { action: 'deleteConfirm', params: '7' } },
      userSocial: { id: 1 },
      from: { id: 1 },
      i18n: { t },
      tryAnswerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
    };

    await update.onAction(ctx as any);

    expect(t).toHaveBeenCalledWith(
      LocalePhrase.Page_ScheduleNotif_ConfirmDelete,
      { targetName: 'Группа: ЦИС-11' },
    );
  });

  it('saves a current-week notif without a day offset', async () => {
    const draftService = { create: jest.fn().mockResolvedValue('draft') };
    const update = new TgScheduleNotifUpdate(
      {} as any,
      draftService as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (update as any).openSettings = jest.fn();
    const ctx = {
      chat: { type: 'private' },
      match: { groups: { action: 'save', params: '8:30:week:none:1' } },
      userSocial: { id: 1 },
      from: { id: 1 },
      i18n: { t: jest.fn().mockReturnValue('Сохранено') },
      tryAnswerCbQuery: jest.fn(),
    };

    await update.onAction(ctx as any);

    expect(draftService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          period: 'week',
          targetDayOffset: null,
          weekdays: [1],
        }),
      }),
    );
  });

  it('ignores an unchanged Telegram inline message', async () => {
    const update = new TgScheduleNotifUpdate(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      editMessageText: jest.fn().mockRejectedValue(
        new TelegramError({
          error_code: 400,
          description:
            'Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message',
        }),
      ),
    };

    await expect(
      (update as any).editStep(ctx, 'Текст', { reply_markup: {} }),
    ).resolves.toBeUndefined();
  });

  it('rethrows other Telegram edit errors', async () => {
    const update = new TgScheduleNotifUpdate(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const error = new TelegramError({
      error_code: 400,
      description: 'Bad Request: message to edit not found',
    });
    const ctx = {
      editMessageText: jest.fn().mockRejectedValue(error),
    };

    await expect(
      (update as any).editStep(ctx, 'Текст', { reply_markup: {} }),
    ).rejects.toBe(error);
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
