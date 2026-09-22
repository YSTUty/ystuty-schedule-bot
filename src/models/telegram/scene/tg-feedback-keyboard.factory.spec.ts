import { LocalePhrase } from '@my-interfaces';

import { TgFeedbackKeyboardFactory } from './tg-feedback-keyboard.factory';

describe('TgFeedbackKeyboardFactory', () => {
  const ctx = {
    i18n: { t: jest.fn((phrase: string) => phrase) },
  } as any;

  it('builds category callbacks for the feedback scene', () => {
    const buttons = new TgFeedbackKeyboardFactory()
      .getFeedbackCategories(ctx)
      .reply_markup.inline_keyboard.flat();

    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callback_data: 'feedback:category:schedule',
        }),
        expect.objectContaining({ callback_data: 'feedback:category:bot' }),
        expect.objectContaining({
          callback_data: 'feedback:category:suggestion',
        }),
        expect.objectContaining({ callback_data: 'feedback:category:other' }),
        expect.objectContaining({
          callback_data: LocalePhrase.Button_Cancel,
          style: 'danger',
        }),
      ]),
    );
  });

  it('marks feedback submit and cancel actions with their visual styles', () => {
    const buttons = new TgFeedbackKeyboardFactory()
      .getFeedbackCollector(ctx)
      .reply_markup.inline_keyboard.flat();

    expect(buttons).toEqual([
      expect.objectContaining({
        callback_data: 'feedback:submit',
        style: 'success',
      }),
      expect.objectContaining({
        callback_data: LocalePhrase.Button_Cancel,
        style: 'danger',
      }),
    ]);
  });
});
