import { TelegramKeyboardFactory } from './telegram-keyboard.factory';

describe('TelegramKeyboardFactory', () => {
  const ctx = {
    i18n: { t: (phrase: string) => phrase },
  } as any;

  it('shows all notification hours when editing an existing notification', () => {
    const keyboard = new TelegramKeyboardFactory().getScheduleNotificationHours(
      ctx,
      1,
      7,
    );
    const buttons = keyboard.reply_markup.inline_keyboard.flat();

    expect(buttons.filter((button) => 'callback_data' in button)).toHaveLength(
      19,
    );
    expect(buttons[0]).toMatchObject({
      callback_data: 'scheduleNotification:editHour:7:6',
    });
  });

  it('opens hour selection before choosing minutes in the notification editor', () => {
    const keyboard =
      new TelegramKeyboardFactory().getScheduleNotificationEditor(ctx, {
        id: 7,
        deliveryHour: 8,
        deliveryMinute: 30,
        targetDayOffset: 0,
        weekdays: [1],
      });

    expect(keyboard.reply_markup.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'scheduleNotification:editTime:7',
    });
  });
});
