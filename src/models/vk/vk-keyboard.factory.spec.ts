import { LocalePhrase } from '@my-interfaces';

import { ScheduleNotifPeriod } from '../schedule-notif/schedule-notif.types';

import { VKKeyboardFactory } from './vk-keyboard.factory';

describe('VKKeyboardFactory', () => {
  const ctx = {
    i18n: { t: jest.fn((phrase: string) => phrase) },
  } as any;

  it('limits schedule notif group labels to 40 characters', () => {
    const keyboard = new VKKeyboardFactory().getPagination({
      currentPage: 1,
      totalPages: 1,
      items: ['Очень длинное название учебной группы для проверки лимита VK'],
      getPagePayload: () => ({}),
    });

    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons[0][0].action.label).toHaveLength(40);
  });

  it('builds welcome quick actions for selecting a group, notifications and chat invite', () => {
    const keyboard = new VKKeyboardFactory().getWelcomeFeatures({
      ...ctx,
      $groupId: 42,
    });
    const buttons = JSON.parse(String(keyboard.inline())).buttons.flat();

    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: expect.objectContaining({
            payload: JSON.stringify({ phrase: 'button.select_group' }),
          }),
        }),
        expect.objectContaining({
          action: expect.objectContaining({
            payload: JSON.stringify({
              phrase: 'button.schedule_notification.title',
            }),
          }),
        }),
        expect.objectContaining({
          action: expect.objectContaining({
            app_id: 6441755,
            owner_id: -42,
          }),
        }),
      ]),
    );
    expect(JSON.parse(String(keyboard.inline())).buttons[0]).toHaveLength(1);
    expect(JSON.parse(String(keyboard.inline())).buttons[1]).toHaveLength(1);
  });

  it('puts the schedule notification on its own row in the private keyboard', () => {
    const keyboard = new VKKeyboardFactory().getStart({
      ...ctx,
      isDM: true,
      peerId: 42,
      senderId: 42,
      session: {},
      state: { user: {}, userSocial: {} },
    });
    const buttons = JSON.parse(String(keyboard)).buttons;

    const profileRow = buttons.find(
      (row: any[]) => row[0]?.action.label === LocalePhrase.Button_Profile,
    );
    const notificationRow = buttons.find(
      (row: any[]) =>
        row[0]?.action.label === LocalePhrase.Button_ScheduleNotif,
    );

    expect(profileRow).toHaveLength(1);
    expect(notificationRow).toHaveLength(1);
  });

  it('builds the fallback help button as an inline callback', () => {
    const keyboard = new VKKeyboardFactory().getUnknownMessageHelp(ctx);
    const renderedKeyboard = JSON.parse(String(keyboard));

    expect(renderedKeyboard.buttons[0][0].action).toMatchObject({
      label: 'button.help',
      payload: JSON.stringify({ mainAction: 'help' }),
    });
  });

  it('adds week navigation with the target and selected week in callback payload', () => {
    const keyboard = new VKKeyboardFactory().getSchedule(
      ctx,
      { type: 'teacher', id: 42 },
      { previousWeekNumber: 4, nextWeekNumber: 6 },
    );
    const buttons = JSON.parse(String(keyboard.inline())).buttons.flat();
    const payloads = buttons.map((button: any) =>
      JSON.parse(button.action.payload),
    );

    expect(payloads).toEqual(
      expect.arrayContaining([
        {
          phrase: 'button.schedule.previous_week',
          teacherId: 42,
          weekNumber: 4,
        },
        {
          phrase: 'button.schedule.next_week',
          teacherId: 42,
          weekNumber: 6,
        },
      ]),
    );
    expect(ctx.i18n.t).toHaveBeenCalledWith('button.schedule.previous_week', {
      weekNumber: 4,
    });
    expect(ctx.i18n.t).toHaveBeenCalledWith('button.schedule.next_week', {
      weekNumber: 6,
    });
  });

  it('creates a schedule notif editor within VK inline keyboard limits', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifEditor(ctx, {
      id: 1,
      deliveryHour: 8,
      deliveryMinute: 30,
      period: ScheduleNotifPeriod.Day,
      targetDayOffset: 0,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
    });

    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const buttonsCount = renderedKeyboard.buttons.flat().length;

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(buttonsCount).toBeLessThanOrEqual(10);
  });

  it('creates the editor weekday page within VK inline keyboard limits', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifEditorWeekdays(
      ctx,
      {
        id: 1,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      },
    );
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons.flat()).toHaveLength(8);
  });

  it('opens hour selection before choosing minutes in the notif editor', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifEditor(ctx, {
      id: 7,
      deliveryHour: 8,
      deliveryMinute: 30,
      period: ScheduleNotifPeriod.Day,
      targetDayOffset: 0,
      weekdays: [1],
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(
      JSON.parse(renderedKeyboard.buttons[0][0].action.payload)
        .scheduleNotifAction,
    ).toBe('editTime');
  });

  it('offers the current week as a schedule-notification target', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifTarget(ctx, 8, 30);
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const payloads = renderedKeyboard.buttons
      .flat()
      .map((button: any) => JSON.parse(button.action.payload));

    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scheduleNotifAction: 'target',
          period: 'week',
          targetDayOffset: null,
        }),
      ]),
    );
  });

  it('asks for deletion confirmation instead of deleting immediately', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifSettings(ctx, {
      id: 7,
      isEnabled: true,
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const deleteButton = renderedKeyboard.buttons
      .flat()
      .find(
        (button: any) =>
          button.action.label === 'button.schedule_notification.delete',
      );

    expect(JSON.parse(deleteButton.action.payload).scheduleNotifAction).toBe(
      'deleteConfirm',
    );
  });

  it('uses a compact three-button pager for notif hours', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifHours(ctx);
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(renderedKeyboard.buttons[2]).toHaveLength(3);
    expect(renderedKeyboard.buttons[2][1].action.label).toBe('-1-');
  });

  it('opens the audience filters editor from broadcast settings', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastSettings(ctx, {
      onlyAuthorized: true,
      groupName: 'ЦИС-21',
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const actions = renderedKeyboard.buttons
      .flat()
      .map((button: any) => JSON.parse(button.action.payload).broadcastAction);

    expect(actions).toEqual(expect.arrayContaining(['filters']));
  });

  it('keeps the broadcast campaigns list within the VK inline keyboard row limit', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastCampaignsList(
      ctx,
      Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        status: 'completed',
      })),
    );
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons).toHaveLength(6);
    expect(renderedKeyboard.buttons.flat()).toHaveLength(6);
  });

  it('renders recipient actions, a URL link and feedback within VK inline keyboard limits', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastRecipientKeyboard({
      deliveryId: 15,
      actionKeyboard: [
        { type: 'select_group' },
        { type: 'start' },
        { type: 'link', text: 'Открыть сайт', url: 'https://ystuty.ru/' },
      ],
      feedbackButton: { text: '🫡' },
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(renderedKeyboard.buttons.flat()).toHaveLength(4);
    expect(
      JSON.parse(renderedKeyboard.buttons[0][0].action.payload),
    ).toMatchObject({
      broadcastRecipientAction: 'select_group',
      deliveryId: 15,
    });
    expect(
      JSON.parse(renderedKeyboard.buttons[1][0].action.payload),
    ).toMatchObject({
      broadcastRecipientAction: 'start',
      deliveryId: 15,
    });
    expect(renderedKeyboard.buttons[2][0].action.link).toBe(
      'https://ystuty.ru/',
    );
  });

  it('keeps action settings within VK limits and opens a separate text selector', () => {
    const actionTextLabels = {
      'button.broadcast.action_text': 'Edit title',
      'button.broadcast.action_link_url': 'Edit URL',
      'button.broadcast.back_to_settings': 'Back',
    };
    const keyboard = new VKKeyboardFactory().getBroadcastActionSettings(
      {
        i18n: {
          t: (phrase: keyof typeof actionTextLabels) =>
            actionTextLabels[phrase] || phrase,
        },
      } as any,
      [
        { type: 'select_group' },
        { type: 'auth' },
        { type: 'start' },
        { type: 'unsubscribe' },
        { type: 'link', text: 'Открыть сайт', url: 'https://ystuty.ru/' },
      ],
    );
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const buttons = renderedKeyboard.buttons.flat();
    const getButton = (action: string) =>
      buttons.find(
        (button: any) =>
          JSON.parse(button.action.payload).broadcastAction === action,
      );

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(buttons).toHaveLength(8);
    expect(getButton('actionTextSelector').action.label).toBe('Edit title');
    expect(getButton('actionLinkUrl').action.label).toBe('Edit URL');
    expect(getButton('actionSelectGroupToggle').color).toBe('positive');
    expect(getButton('actionLinkToggle').color).toBe('positive');
  });

  it('shows all enabled action buttons on the separate text selector', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastActionTextSelector(
      {
        i18n: { t: (phrase: string) => phrase },
      } as any,
      [
        { type: 'select_group' },
        { type: 'auth' },
        { type: 'start' },
        { type: 'unsubscribe' },
        { type: 'link', text: 'Открыть сайт', url: 'https://ystuty.ru/' },
      ],
    );
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const actions = renderedKeyboard.buttons
      .flat()
      .map((button: any) => JSON.parse(button.action.payload).broadcastAction);

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(renderedKeyboard.buttons.flat()).toHaveLength(6);
    expect(actions).toEqual(
      expect.arrayContaining([
        'actionSelectGroupText',
        'actionAuthText',
        'actionStartText',
        'actionUnsubscribeText',
        'actionLinkText',
      ]),
    );
  });

  it('offers every feedback button behavior after the initial click', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastFeedbackSettings(ctx, {
      text: '🫡',
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const actions = renderedKeyboard.buttons
      .flat()
      .map((button: any) => JSON.parse(button.action.payload).broadcastAction);

    expect(actions).toEqual(
      expect.arrayContaining([
        'feedbackAfterDelete',
        'feedbackAfterKeep',
        'feedbackAfterReplace',
      ]),
    );
  });

  it('highlights the selected feedback behavior in green', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastFeedbackSettings(ctx, {
      text: '🫡',
      afterClickMode: 'keep',
    });
    const buttons = JSON.parse(String(keyboard.inline())).buttons.flat();
    const getButton = (action: string) =>
      buttons.find(
        (button: any) =>
          JSON.parse(button.action.payload).broadcastAction === action,
      );

    expect(getButton('feedbackAfterKeep').color).toBe('positive');
    expect(getButton('feedbackAfterDelete').color).toBe('secondary');
    expect(getButton('feedbackAfterReplace').color).toBe('secondary');
  });
});
