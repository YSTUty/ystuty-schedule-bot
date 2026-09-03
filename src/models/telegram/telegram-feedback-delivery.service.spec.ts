import { TelegramError } from 'telegraf-hardened';

import {
  FeedbackCategory,
  FeedbackDeliveryStatus,
} from '../feedback/feedback.types';

import { TelegramFeedbackDeliveryService } from './telegram-feedback-delivery.service';

jest.mock('@my-environment', () => ({
  SOCIAL_TELEGRAM_ADMIN_IDS: [100],
}));

describe('TelegramFeedbackDeliveryService', () => {
  const feedback = {
    id: 7,
    category: FeedbackCategory.Bot,
    sourcePeerId: '42',
    content: { messages: [{ messageId: 10 }] },
  };
  const delivery = {
    id: 3,
    feedbackId: feedback.id,
    adminId: '100',
    headerSentAt: null as Date | null,
    feedback,
  };
  const feedbackService = {
    ensureAdminDeliveries: jest.fn(),
    findDueAdminDeliveries: jest.fn(),
    markAdminDeliveryFailed: jest.fn(),
    markAdminDeliveryHeaderSent: jest.fn(),
    markAdminDeliveryRetry: jest.fn(),
    markAdminDeliverySent: jest.fn(),
    refreshDeliveryStatus: jest.fn(),
    setDeliveryResult: jest.fn(),
  };
  const telegramService = {
    bot: { telegram: { sendMessage: jest.fn(), forwardMessages: jest.fn() } },
  };
  const service = new TelegramFeedbackDeliveryService(
    feedbackService as any,
    telegramService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    delivery.headerSentAt = null;
    feedbackService.ensureAdminDeliveries.mockResolvedValue([delivery]);
    feedbackService.refreshDeliveryStatus.mockResolvedValue(
      FeedbackDeliveryStatus.Sent,
    );
    telegramService.bot.telegram.sendMessage.mockResolvedValue({});
    telegramService.bot.telegram.forwardMessages.mockResolvedValue([]);
  });

  it('persists header progress before forwarding source messages', async () => {
    await expect(service.deliver(feedback as any)).resolves.toBe(true);

    expect(feedbackService.markAdminDeliveryHeaderSent).toHaveBeenCalledWith(3);
    expect(telegramService.bot.telegram.forwardMessages).toHaveBeenCalledWith(
      100,
      42,
      [10],
    );
    expect(feedbackService.markAdminDeliverySent).toHaveBeenCalledWith(3);
  });

  it('schedules a Telegram retry using retry_after without resending the header', async () => {
    delivery.headerSentAt = new Date();
    telegramService.bot.telegram.forwardMessages.mockRejectedValue(
      new TelegramError({
        error_code: 429,
        description: 'Too Many Requests',
        parameters: { retry_after: 3 },
      }),
    );
    feedbackService.refreshDeliveryStatus.mockResolvedValue(
      FeedbackDeliveryStatus.Pending,
    );

    await expect(service.deliver(feedback as any)).resolves.toBe(false);

    expect(telegramService.bot.telegram.sendMessage).not.toHaveBeenCalled();
    expect(feedbackService.markAdminDeliveryRetry).toHaveBeenCalledWith(
      3,
      3_000,
      expect.stringContaining('Too Many Requests'),
    );
  });
});
