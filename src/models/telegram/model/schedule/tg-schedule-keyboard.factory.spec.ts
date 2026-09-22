import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';

import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

import { TgScheduleKeyboardFactory } from './tg-schedule-keyboard.factory';

describe('TgScheduleKeyboardFactory', () => {
  const ctx = {
    i18n: { t: jest.fn((phrase: string) => phrase) },
  } as any;

  it('keeps group schedule callbacks compact for long names', () => {
    const groupName = 'Научно-исслед сем';
    const keyboard = new TgScheduleKeyboardFactory(
      new TelegramKeyboardFactory(),
    ).getScheduleInline(ctx, { type: 'group', id: groupName });
    const buttons = keyboard.reply_markup.inline_keyboard.flat();

    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callback_data: `${LocalePhrase.Button_Schedule_ForToday}:g:${md5(groupName).slice(0, 12)}`,
        }),
      ]),
    );
    expect(
      buttons.every(
        (button) =>
          !('callback_data' in button) ||
          Buffer.byteLength(button.callback_data, 'utf8') <= 64,
      ),
    ).toBe(true);
  });
});
