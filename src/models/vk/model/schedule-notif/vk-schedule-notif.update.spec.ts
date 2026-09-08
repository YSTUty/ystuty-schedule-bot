import { ListenerDecorator } from 'nestjs-vk';

import { LocalePhrase } from '@my-interfaces';

import { VkScheduleNotifUpdate } from './vk-schedule-notif.update';

describe('VkScheduleNotifUpdate', () => {
  it('acknowledges the welcome-card notification callback', async () => {
    const update = new VkScheduleNotifUpdate(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (update as any).openSettings = jest.fn();
    const ctx = {
      eventPayload: { phrase: LocalePhrase.Button_ScheduleNotif },
      isDM: true,
      state: { userSocial: { id: 1 } },
      answer: jest.fn(),
    };

    await update.onMessageEvent(ctx as any);

    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'Открываю настройки',
    });
    expect((update as any).openSettings).toHaveBeenCalledWith(ctx);
  });

  it('only routes schedule-notification callbacks', () => {
    const listener = Reflect.getMetadata(
      ListenerDecorator.KEY,
      VkScheduleNotifUpdate.prototype.onMessageEvent,
    ).find(
      (item: { handlerType: string }) => item.handlerType === 'message_event',
    );

    expect(listener.event({ scheduleNotifAction: 'settings' }, {})).toBe(true);
    expect(
      listener.event(
        { phrase: LocalePhrase.Button_ScheduleNotif },
        { scene: { current: {} } },
      ),
    ).toBe(true);
    expect(listener.event({ teacherAction: 'list' }, {})).toBe(false);
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
      getScheduleNotifDeleteConfirmation: jest
        .fn()
        .mockReturnValue({ inline: () => ({}) }),
    };
    const update = new VkScheduleNotifUpdate(
      notifService as any,
      {} as any,
      { getTeacherName: jest.fn() } as any,
      keyboardFactory as any,
      {} as any,
    );
    const t = jest.fn().mockReturnValue('confirm delete');
    const ctx = {
      eventPayload: { scheduleNotifAction: 'deleteConfirm', notifId: 7 },
      isDM: true,
      state: { userSocial: { id: 1 } },
      i18n: { t },
      editMessage: jest.fn(),
    };

    await update.onMessageEvent(ctx as any);

    expect(t).toHaveBeenCalledWith(
      LocalePhrase.Page_ScheduleNotif_ConfirmDelete,
      { targetName: 'Группа: ЦИС-11' },
    );
  });

  it('saves a current-week notif without a day offset', async () => {
    const draftService = { create: jest.fn().mockResolvedValue('draft') };
    const update = new VkScheduleNotifUpdate(
      {} as any,
      draftService as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (update as any).openSettings = jest.fn();
    const ctx = {
      eventPayload: {
        scheduleNotifAction: 'save',
        hour: 8,
        minute: 30,
        period: 'week',
        targetDayOffset: null,
        weekdays: [1],
      },
      isDM: true,
      state: { userSocial: { id: 1 } },
      answer: jest.fn(),
      i18n: { t: jest.fn().mockReturnValue('Сохранено') },
    };

    await update.onMessageEvent(ctx as any);

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

  it('keeps the weekday selector open after changing a weekday', async () => {
    const notif = {
      id: 7,
      targetType: 'group',
      targetId: 'ЦИС-11',
      deliveryHour: 8,
      deliveryMinute: 30,
      period: 'week',
      targetDayOffset: null,
      weekdays: [1],
      isEnabled: true,
    };
    const notifService = {
      getNotif: jest.fn().mockResolvedValue(notif),
      updateSettings: jest.fn(),
    };
    const keyboardFactory = {
      getScheduleNotifEditorWeekdays: jest
        .fn()
        .mockReturnValue({ inline: () => ({}) }),
    };
    const update = new VkScheduleNotifUpdate(
      notifService as any,
      {} as any,
      {} as any,
      keyboardFactory as any,
      {} as any,
    );
    const ctx = {
      eventPayload: {
        scheduleNotifAction: 'editWeekday',
        notifId: notif.id,
        weekday: 2,
      },
      isDM: true,
      state: { userSocial: { id: 1 } },
      i18n: { t: jest.fn((phrase) => phrase) },
      editMessage: jest.fn(),
    };

    await update.onMessageEvent(ctx as any);

    expect(notifService.updateSettings).toHaveBeenCalledWith(1, notif.id, {
      deliveryHour: 8,
      deliveryMinute: 30,
      period: 'week',
      targetDayOffset: null,
      weekdays: [1, 2],
    });
    expect(keyboardFactory.getScheduleNotifEditorWeekdays).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ id: notif.id, weekdays: [1, 2] }),
    );
    expect(ctx.editMessage).toHaveBeenCalled();
  });

  it('checks conversation admin via cached vk service members', async () => {
    const vkService = {
      getCachedConvMembers: jest
        .fn()
        .mockResolvedValue([{ member_id: 5, is_admin: true }]),
    };
    const update = new VkScheduleNotifUpdate(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      vkService as any,
    );
    const ctx = {
      isDM: false,
      peerId: 2000000001,
      senderId: 5,
      state: {
        conversation: { invitedByUserSocialId: 2 },
        userSocial: { id: 1 },
      },
    };

    await expect((update as any).canManage(ctx)).resolves.toBe(true);
    expect(vkService.getCachedConvMembers).toHaveBeenCalledWith(2000000001);
  });
});
