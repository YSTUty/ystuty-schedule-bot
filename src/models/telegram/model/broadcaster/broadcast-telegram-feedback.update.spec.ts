import { BroadcastTelegramFeedbackUpdate } from './broadcast-telegram-feedback.update';

describe('BroadcastTelegramFeedbackUpdate', () => {
  it('synchronizes a deleted feedback button after a duplicate callback', async () => {
    const keyboardFactory = {
      getBroadcastRecipientKeyboard: jest.fn().mockReturnValue({
        reply_markup: { inline_keyboard: [['start']] },
      }),
    };
    const update = new BroadcastTelegramFeedbackUpdate(
      {
        recordCampaignFeedback: jest.fn().mockResolvedValue({
          created: false,
          feedbackButton: { text: '🫡', afterClickMode: 'delete' },
          actionKeyboard: [{ type: 'start' }],
        }),
      } as any,
      keyboardFactory as any,
    );
    const ctx = {
      match: { groups: { deliveryId: '15', action: 'initial' } },
      userSocial: { id: 7 },
      editMessageReplyMarkup: jest.fn(),
      i18n: { t: jest.fn().mockReturnValue('already received') },
      tryAnswerCbQuery: jest.fn(),
    };

    await update.onBroadcastFeedback(ctx as any);

    expect(keyboardFactory.getBroadcastRecipientKeyboard).toHaveBeenCalledWith({
      deliveryId: 15,
      actionKeyboard: [{ type: 'start' }],
      feedbackAction: 'repeat',
      feedbackButton: null,
    });
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({
      inline_keyboard: [['start']],
    });
  });
});
