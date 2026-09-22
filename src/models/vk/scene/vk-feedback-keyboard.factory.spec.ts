import { LocalePhrase } from '@my-interfaces';

import { VkFeedbackKeyboardFactory } from './vk-feedback-keyboard.factory';

describe('VkFeedbackKeyboardFactory', () => {
  const ctx = {
    i18n: { t: jest.fn((phrase: string) => phrase) },
  } as any;

  it('builds inline callbacks for all feedback categories', () => {
    const keyboard = new VkFeedbackKeyboardFactory().getFeedbackCategories(ctx);
    const buttons = JSON.parse(String(keyboard)).buttons.flat();

    expect(buttons.map((button: any) => button.action.type)).toEqual([
      'callback',
      'callback',
      'callback',
      'callback',
      'callback',
    ]);
    expect(
      buttons.map((button: any) => JSON.parse(button.action.payload)),
    ).toEqual([
      { feedbackAction: 'category', category: 'schedule' },
      { feedbackAction: 'category', category: 'bot' },
      { feedbackAction: 'category', category: 'suggestion' },
      { feedbackAction: 'category', category: 'other' },
      { feedbackAction: 'cancel' },
    ]);
  });

  it('builds styled submit and cancel actions for collecting feedback', () => {
    const keyboard = new VkFeedbackKeyboardFactory().getFeedbackCollector(ctx);
    const buttons = JSON.parse(String(keyboard)).buttons.flat();

    expect(buttons).toEqual([
      expect.objectContaining({
        color: 'positive',
        action: expect.objectContaining({
          label: LocalePhrase.Button_Feedback_Submit,
          payload: JSON.stringify({ feedbackAction: 'submit' }),
        }),
      }),
      expect.objectContaining({
        color: 'negative',
        action: expect.objectContaining({
          label: LocalePhrase.Button_Cancel,
          payload: JSON.stringify({ feedbackAction: 'cancel' }),
        }),
      }),
    ]);
  });
});
