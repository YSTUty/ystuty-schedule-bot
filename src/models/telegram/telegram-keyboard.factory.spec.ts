import { TelegramKeyboardFactory } from './telegram-keyboard.factory';

describe('TelegramKeyboardFactory', () => {
  const ctx = {
    i18n: { t: (phrase: string) => phrase },
  } as any;

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

  it('builds welcome quick actions for selecting a group, notifications and chat invite', () => {
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
          url: expect.stringContaining('?startgroup=invite'),
        }),
      ]),
    );
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
    const settingsButtons = factory.getScheduleNotifSettings(ctx, {
      id: 7,
      isEnabled: true,
    }).reply_markup.inline_keyboard;

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

  it('opens hour selection before choosing minutes in the notif editor', () => {
    const keyboard = new TelegramKeyboardFactory().getScheduleNotifEditor(ctx, {
      id: 7,
      deliveryHour: 8,
      deliveryMinute: 30,
      targetDayOffset: 0,
      weekdays: [1],
    });

    expect(keyboard.reply_markup.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'scheduleNotif:editTime:7',
    });
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
