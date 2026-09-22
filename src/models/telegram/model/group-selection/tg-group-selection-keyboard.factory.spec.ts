import { md5 } from '@my-common';

import { TgGroupSelectionKeyboardFactory } from './tg-group-selection-keyboard.factory';

describe('TgGroupSelectionKeyboardFactory', () => {
  it('creates a compact callback for a selected group', () => {
    const groupName = 'Очень длинное название учебной группы для проверки';
    const keyboard = new TgGroupSelectionKeyboardFactory().getSelectGroupInline(
      { i18n: { t: jest.fn((phrase: string) => phrase) } } as any,
      groupName,
    );

    expect(keyboard.reply_markup.inline_keyboard[0][0]).toMatchObject({
      callback_data: `selectGroup:${md5(groupName).slice(0, 12)}`,
    });
  });
});
