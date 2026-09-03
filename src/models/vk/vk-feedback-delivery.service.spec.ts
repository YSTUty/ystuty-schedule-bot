import { APIError, APIErrorCode } from 'vk-io';

import {
  FeedbackCategory,
  FeedbackDeliveryStatus,
} from '../feedback/feedback.types';

import { VkFeedbackDeliveryService } from './vk-feedback-delivery.service';

jest.mock('@my-environment', () => ({
  SOCIAL_VK_ADMIN_IDS: [100],
}));

describe('VkFeedbackDeliveryService', () => {
  const feedback = {
    id: 7,
    category: FeedbackCategory.Bot,
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
  const vkService = { bot: { api: { messages: { send: jest.fn() } } } };
  const service = new VkFeedbackDeliveryService(
    feedbackService as any,
    vkService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    delivery.headerSentAt = null;
    feedbackService.ensureAdminDeliveries.mockResolvedValue([delivery]);
    feedbackService.refreshDeliveryStatus.mockResolvedValue(
      FeedbackDeliveryStatus.Sent,
    );
    vkService.bot.api.messages.send.mockResolvedValue(1);
  });

  it('sends the header and forwarded messages to the administrator', async () => {
    await expect(service.deliver(feedback as any)).resolves.toBe(true);

    expect(vkService.bot.api.messages.send).toHaveBeenCalledTimes(2);
    expect(feedbackService.markAdminDeliveryHeaderSent).toHaveBeenCalledWith(3);
    expect(feedbackService.markAdminDeliverySent).toHaveBeenCalledWith(3);
  });

  it('schedules a VK rate-limit retry after one second', async () => {
    delivery.headerSentAt = new Date();
    vkService.bot.api.messages.send.mockRejectedValue(
      new APIError({
        error_code: APIErrorCode.RATE_LIMIT,
        error_msg: 'Too many requests per second',
        request_params: [],
      }),
    );
    feedbackService.refreshDeliveryStatus.mockResolvedValue(
      FeedbackDeliveryStatus.Pending,
    );

    await expect(service.deliver(feedback as any)).resolves.toBe(false);

    expect(feedbackService.markAdminDeliveryRetry).toHaveBeenCalledWith(
      3,
      1_000,
      expect.stringContaining('Too many requests'),
    );
  });
});
