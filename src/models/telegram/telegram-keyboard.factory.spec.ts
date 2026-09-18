import * as xEnv from '@my-environment';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';

import { TelegramKeyboardFactory } from './telegram-keyboard.factory';

describe('TelegramKeyboardFactory', () => {
  const ctx = {
    i18n: { t: jest.fn((phrase: string) => phrase) },
  } as any;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows all notif hours when creating a notif', () => {
    const keyboard = new TelegramKeyboardFactory().getScheduleNotifHours(
      ctx,
      1,
    );
    const buttons = keyboard.reply_markup.inline_keyboard.flat();

    expect(buttons.filter((button) => 'callback_data' in button)).toHaveLength(
      19,
    );
    expect(buttons[0]).toMatchObject({
      callback_data: 'scheduleNotif:hour:6',
    });
  });

  it('builds welcome quick actions for selecting a group, notifications, guide and chat invite', () => {
    const keyboard = new TelegramKeyboardFactory().getWelcomeFeatures(ctx);
    const buttons = keyboard.reply_markup.inline_keyboard.flat();

    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callback_data: 'button.select_group',
        }),
        expect.objectContaining({
          callback_data: 'button.schedule_notification.title',
        }),
        expect.objectContaining({
          callback_data: 'help:open',
          text: LocalePhrase.Button_Welcome_Guide,
          style: 'primary',
        }),
        expect.objectContaining({
          callback_data: 'calendar:open',
          text: LocalePhrase.Button_Calendar,
          style: 'primary',
        }),
        expect.objectContaining({
          url: expect.stringContaining('?startgroup=invite'),
        }),
      ]),
    );
    expect(keyboard.reply_markup.inline_keyboard[0]).toHaveLength(1);
    expect(keyboard.reply_markup.inline_keyboard[1]).toHaveLength(1);
  });

  it('puts the schedule notification on its own row in the private keyboard', () => {
    const keyboard = new TelegramKeyboardFactory().getStart({
      chat: { type: 'private' },
      from: { id: 42 },
      user: {},
      session: {},
      i18n: { t: (phrase: string) => phrase },
    } as any);

    expect(keyboard.reply_markup.keyboard).toEqual(
      expect.arrayContaining([
        [LocalePhrase.Button_Profile],
        [LocalePhrase.Button_ScheduleNotif],
        [LocalePhrase.Button_Calendar],
      ]),
    );
  });

  it('shows configured Mini Apps only in private-chat keyboards', () => {
    jest.replaceProperty(
      xEnv,
      'SOCIAL_TELEGRAM_WEBAPP_URL',
      'https://mini-app.example/one',
    );
    jest.replaceProperty(
      xEnv,
      'SOCIAL_TELEGRAM_BOT_WEBAPP_NAME',
      'Основное приложение',
    );
    jest.replaceProperty(
      xEnv,
      'SOCIAL_TELEGRAM_WEBAPP_URL_2',
      'https://mini-app.example/two',
    );
    jest.replaceProperty(
      xEnv,
      'SOCIAL_TELEGRAM_BOT_WEBAPP_NAME_2',
      'Второе приложение',
    );

    const factory = new TelegramKeyboardFactory();
    const privateKeyboard = factory.getStart({
      chat: { type: 'private' },
      from: { id: 42 },
      session: {},
      i18n: { t: (phrase: string) => phrase },
    } as any);
    const welcomeKeyboard = factory.getWelcomeFeatures(ctx);
    const groupKeyboard = factory.getStart({
      chat: { type: 'group' },
      from: { id: 42 },
      session: {},
      i18n: { t: (phrase: string) => phrase },
    } as any);

    const privateButtons = privateKeyboard.reply_markup.keyboard.flat();
    const welcomeButtons = welcomeKeyboard.reply_markup.inline_keyboard.flat();
    const groupButtons = groupKeyboard.reply_markup.keyboard.flat();

    const appButtons = [
      expect.objectContaining({
        text: 'Основное приложение',
        style: 'primary',
        web_app: { url: 'https://mini-app.example/one' },
      }),
      expect.objectContaining({
        text: 'Второе приложение',
        style: 'success',
        web_app: { url: 'https://mini-app.example/two' },
      }),
    ];

    expect(privateButtons).toEqual(expect.arrayContaining(appButtons));
    expect(welcomeButtons).toEqual(expect.arrayContaining(appButtons));
    expect(groupButtons).not.toEqual(expect.arrayContaining(appButtons));
  });

  it('builds the fallback help button as an inline callback', () => {
    const keyboard = new TelegramKeyboardFactory().getUnknownMessageHelp(ctx);

    expect(keyboard.reply_markup.inline_keyboard).toEqual([
      [
        expect.objectContaining({
          callback_data: 'help:open',
          text: 'button.help',
        }),
      ],
    ]);
  });

  it('keeps the broadcast campaigns page in detail and back callbacks', () => {
    const keyboard = new TelegramKeyboardFactory().getBroadcastCampaignsList(
      ctx,
      {
        items: Array.from({ length: 8 }, (_, index) => ({
          id: index + 1,
          status: 'completed',
        })),
        currentPage: 2,
        totalPages: 3,
      },
    );
    const buttons = keyboard.reply_markup.inline_keyboard.flat();
    const detailsKeyboard = new TelegramKeyboardFactory()
      .getBroadcastCampaignDetails(ctx, {
        campaignId: 12,
        page: 2,
        active: false,
        paused: false,
      })
      .reply_markup.inline_keyboard.flat();

    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callback_data: 'broadcast:campaign:detail:1:2',
        }),
        expect.objectContaining({
          callback_data: 'pager:broadcast-campaigns:3',
        }),
      ]),
    );
    expect(detailsKeyboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callback_data: 'broadcast:campaign:list:2',
        }),
      ]),
    );
  });

  it('uses Telegram button colors for primary, successful and destructive actions', () => {
    const factory = new TelegramKeyboardFactory();
    const feedbackButtons =
      factory.getFeedbackCollector(ctx).reply_markup.inline_keyboard;
    const queueButtons = factory.getBroadcastQueueControls(ctx, true)
      .reply_markup.inline_keyboard;
    const deleteButtons = factory.getScheduleNotifDeleteConfirmation(ctx, 7)
      .reply_markup.inline_keyboard;
    const scheduleButtons = factory.getScheduleInline(ctx, {
      type: 'group',
      id: 'ЦИС-46',
    }).reply_markup.inline_keyboard;
    const settingsButtons = factory.getScheduleNotifSettings(
      ctx,
      [{ id: 7, isEnabled: true, targetLabel: 'Группа: ЦИС-11' }],
      true,
    ).reply_markup.inline_keyboard;

    expect(
      factory.getUnknownMessageHelp(ctx).reply_markup.inline_keyboard[0][0],
    ).toMatchObject({ style: 'primary' });
    expect(feedbackButtons[0][0]).toMatchObject({ style: 'success' });
    expect(feedbackButtons[1][0]).toMatchObject({ style: 'danger' });
    expect(queueButtons[0][0]).toMatchObject({ style: 'success' });
    expect(queueButtons[1][0]).toMatchObject({ style: 'danger' });
    expect(deleteButtons[0][0]).toMatchObject({ style: 'danger' });
    expect(scheduleButtons[0][0]).toMatchObject({ style: 'primary' });
    expect(scheduleButtons[1][0]).toMatchObject({ style: 'primary' });
    expect(settingsButtons[0][0]).toMatchObject({ style: 'primary' });
  });

  it('adds week navigation only for available neighboring weeks', () => {
    const keyboard = new TelegramKeyboardFactory().getScheduleInline(
      ctx,
      { type: 'group', id: 'ЦИС-46' },
      { previousWeekNumber: 4, nextWeekNumber: 6 },
    );
    const buttons = keyboard.reply_markup.inline_keyboard.flat();

    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callback_data: `button.schedule.previous_week:g:${md5('ЦИС-46').slice(0, 12)}:week:4`,
          text: 'button.schedule.previous_week',
        }),
        expect.objectContaining({
          callback_data: `button.schedule.next_week:g:${md5('ЦИС-46').slice(0, 12)}:week:6`,
          text: 'button.schedule.next_week',
        }),
      ]),
    );
    expect(ctx.i18n.t).toHaveBeenCalledWith('button.schedule.previous_week', {
      weekNumber: 4,
    });
    expect(ctx.i18n.t).toHaveBeenCalledWith('button.schedule.next_week', {
      weekNumber: 6,
    });
  });

  it('keeps schedule callback data within Telegram limits for a long group', () => {
    const buttons = new TelegramKeyboardFactory()
      .getScheduleInline(
        ctx,
        { type: 'group', id: 'Научно-исслед сем' },
        { previousWeekNumber: 4, nextWeekNumber: 6 },
      )
      .reply_markup.inline_keyboard.flat();

    for (const button of buttons) {
      if ('callback_data' in button) {
        expect(
          Buffer.byteLength(button.callback_data, 'utf8'),
        ).toBeLessThanOrEqual(64);
      }
    }
  });

  it('uses a compact callback for a long selected group', () => {
    const groupName = 'Очень длинное название учебной группы для проверки';
    const button = new TelegramKeyboardFactory().getSelectGroupInline(
      ctx,
      groupName,
    ).reply_markup.inline_keyboard[0][0];

    expect(button).toMatchObject({
      callback_data: `selectGroup:${md5(groupName).slice(0, 12)}`,
    });
    expect('callback_data' in button).toBe(true);
    if ('callback_data' in button) {
      expect(
        Buffer.byteLength(button.callback_data, 'utf8'),
      ).toBeLessThanOrEqual(64);
    }
  });

  it('opens hour selection before choosing minutes in the notif editor', () => {
    const keyboard = new TelegramKeyboardFactory().getScheduleNotifEditor(ctx, {
      id: 7,
      deliveryHour: 8,
      deliveryMinute: 30,
      period: 'day',
      targetDayOffset: 0,
      weekdays: [1],
      isEnabled: true,
    });

    expect(keyboard.reply_markup.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'scheduleNotif:editTime:7',
    });
    expect(keyboard.reply_markup.inline_keyboard.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callback_data: 'scheduleNotif:enabled:7:0',
          text: `⏸️ ${LocalePhrase.Button_ScheduleNotif_Disable}`,
          style: 'danger',
        }),
        expect.objectContaining({
          callback_data: 'scheduleNotif:changeTarget:7',
          text: `✏️ ${LocalePhrase.Button_ScheduleNotif_ChangeTarget}`,
        }),
        expect.objectContaining({
          callback_data: 'scheduleNotif:deleteConfirm:7',
          text: `🗑️ ${LocalePhrase.Button_ScheduleNotif_Delete}`,
          style: 'danger',
        }),
      ]),
    );
    expect(keyboard.reply_markup.inline_keyboard.at(-1)).toEqual([
      expect.objectContaining({
        callback_data: 'scheduleNotif:deleteConfirm:7',
      }),
      expect.objectContaining({
        callback_data: 'scheduleNotif:editSave',
        text: `✅ ${LocalePhrase.Button_ScheduleNotif_Done}`,
      }),
    ]);
  });

  it('offers the current week as a schedule-notification target', () => {
    const keyboard = new TelegramKeyboardFactory().getScheduleNotifTarget(
      ctx,
      8,
      30,
    );
    const callbacks = keyboard.reply_markup.inline_keyboard
      .flat()
      .map((button) => ('callback_data' in button ? button.callback_data : ''));

    expect(callbacks).toEqual(
      expect.arrayContaining([
        'scheduleNotif:target:8:30:day:0',
        'scheduleNotif:target:8:30:day:1',
        'scheduleNotif:target:8:30:week',
      ]),
    );
  });

  it('adds a back button when changing an existing notif target', () => {
    const keyboard = new TelegramKeyboardFactory().getScheduleNotifTargetType(
      ctx,
      'scheduleNotif:targetType:7',
      true,
      'scheduleNotif:edit:7',
    );
    const callbacks = keyboard.reply_markup.inline_keyboard
      .flat()
      .map((button) => ('callback_data' in button ? button.callback_data : ''));

    expect(callbacks).toContain('scheduleNotif:edit:7');
  });

  it('opens the audience filters editor from broadcast settings', () => {
    const keyboard = new TelegramKeyboardFactory().getBroadcastSettings(ctx, {
      onlyAuthorized: true,
      groupName: 'ЦИС-21',
    });
    const callbacks = keyboard.reply_markup.inline_keyboard
      .flat()
      .map((button) => ('callback_data' in button ? button.callback_data : ''));

    expect(callbacks).toEqual(
      expect.arrayContaining(['broadcast:wizard:filters']),
    );
  });

  it('offers the keyboard message text setting only for forwards with buttons', () => {
    const factory = new TelegramKeyboardFactory();
    const getCallbacks = (
      mode: 'copy' | 'forward',
      hasRecipientKeyboard: boolean,
    ) =>
      factory
        .getBroadcastConfirm(ctx, mode, hasRecipientKeyboard)
        .reply_markup.inline_keyboard.flat()
        .map((button) =>
          'callback_data' in button ? button.callback_data : '',
        );

    expect(getCallbacks('forward', true)).toContain(
      'broadcast:wizard:forward-keyboard:text',
    );
    expect(getCallbacks('forward', false)).not.toContain(
      'broadcast:wizard:forward-keyboard:text',
    );
    expect(getCallbacks('copy', true)).not.toContain(
      'broadcast:wizard:forward-keyboard:text',
    );
  });

  it('renders recipient actions, a URL link and feedback into separate inline rows', () => {
    const keyboard =
      new TelegramKeyboardFactory().getBroadcastRecipientKeyboard({
        deliveryId: 15,
        actionKeyboard: [
          { type: 'select_group' },
          { type: 'start' },
          { type: 'link', text: 'Открыть сайт', url: 'https://ystuty.ru/' },
        ],
        feedbackButton: { text: '🫡' },
      });

    expect(keyboard.reply_markup.inline_keyboard).toEqual([
      [
        expect.objectContaining({
          callback_data: 'broadcast:action:15:select_group',
        }),
      ],
      [
        expect.objectContaining({
          callback_data: 'broadcast:action:15:start',
        }),
      ],
      [
        expect.objectContaining({
          text: 'Открыть сайт',
          url: 'https://ystuty.ru/',
        }),
      ],
      [
        expect.objectContaining({
          callback_data: 'broadcast:feedback:15:initial',
        }),
      ],
    ]);
  });

  it('uses distinct localized labels for enabled recipient action text controls', () => {
    const actionTextLabels = {
      'button.broadcast.action_select_group_text': 'Text: group',
      'button.broadcast.action_auth_text': 'Text: auth',
      'button.broadcast.action_start_text': 'Text: start',
      'button.broadcast.action_link_text': 'Text: link',
    };
    const keyboard = new TelegramKeyboardFactory().getBroadcastActionSettings(
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
        { type: 'link', text: 'Открыть сайт', url: 'https://ystuty.ru/' },
      ],
    );
    const buttons = keyboard.reply_markup.inline_keyboard.flat();
    const getButton = (callbackData: string) =>
      buttons.find(
        (button) =>
          'callback_data' in button && button.callback_data === callbackData,
      );

    expect(getButton('broadcast:wizard:actions:select-group:text')?.text).toBe(
      'Text: group',
    );
    expect(getButton('broadcast:wizard:actions:auth:text')?.text).toBe(
      'Text: auth',
    );
    expect(getButton('broadcast:wizard:actions:start:text')?.text).toBe(
      'Text: start',
    );
    expect(getButton('broadcast:wizard:actions:link:text')?.text).toBe(
      'Text: link',
    );
  });

  it('offers every feedback button behavior after the initial click', () => {
    const keyboard = new TelegramKeyboardFactory().getBroadcastFeedbackSettings(
      ctx,
      { text: '🫡' },
    );
    const callbacks = keyboard.reply_markup.inline_keyboard
      .flat()
      .map((button) => ('callback_data' in button ? button.callback_data : ''));

    expect(callbacks).toEqual(
      expect.arrayContaining([
        'broadcast:wizard:feedback:after:delete',
        'broadcast:wizard:feedback:after:keep',
        'broadcast:wizard:feedback:after:replace',
      ]),
    );
  });
});
