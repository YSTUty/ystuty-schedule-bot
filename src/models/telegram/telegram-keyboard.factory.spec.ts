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

  it('adds audience filter controls to broadcast settings', () => {
    const keyboard = new TelegramKeyboardFactory().getBroadcastSettings(ctx, {
      onlyAuthorized: true,
      groupName: 'ЦИС-21',
    });
    const callbacks = keyboard.reply_markup.inline_keyboard
      .flat()
      .map((button) => ('callback_data' in button ? button.callback_data : ''));

    expect(callbacks).toEqual(
      expect.arrayContaining([
        'broadcast:wizard:filter:authorized',
        'broadcast:wizard:filter:group',
        'broadcast:wizard:filter:group:reset',
      ]),
    );
  });
});
