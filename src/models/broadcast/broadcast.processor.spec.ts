import { TelegramError } from 'telegraf-hardened';

import { SocialType } from '@my-common/constants';

import { BroadcastRateLimitError } from './broadcast-rate-limit.exception';
import { BroadcastProcessorBase } from './broadcast.processor';
import {
  BroadcastCampaignStatus,
  BroadcastDeliveryFailureKind,
  BroadcastMessageMode,
} from './broadcast.types';

describe('BroadcastProcessorBase', () => {
  const campaign = {
    id: 7,
    social: SocialType.Telegram,
    mode: BroadcastMessageMode.Text,
    sourceMessage: { text: 'Тест' },
    feedbackButton: null,
    actionKeyboard: null,
    status: BroadcastCampaignStatus.Running,
  };

  const createProcessor = (
    sendError?: Error,
    campaignOverrides: Record<string, unknown> = {},
  ) => {
    const currentCampaign = { ...campaign, ...campaignOverrides };
    const broadcastService = {
      getCampaign: jest.fn().mockResolvedValue(currentCampaign),
      markCampaignRunning: jest.fn().mockResolvedValue(undefined),
      markDeliveryAttempt: jest.fn().mockResolvedValue(undefined),
      markDeliverySent: jest.fn().mockResolvedValue(undefined),
      markDeliveryRetry: jest.fn().mockResolvedValue(undefined),
      markDeliveryFailed: jest.fn().mockResolvedValue(undefined),
      markDeliverySkipped: jest.fn().mockResolvedValue(undefined),
      markCampaignRateLimited: jest.fn().mockResolvedValue(undefined),
      pauseTelegramQueueUntil: jest.fn().mockResolvedValue(undefined),
      refreshCampaignCounters: jest.fn().mockResolvedValue({
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        retryingCount: 0,
        totalCount: 1,
        status: BroadcastCampaignStatus.Running,
        blockedBotCount: 0,
        deactivatedCount: 0,
        unavailableCount: 0,
        rateLimitCount: 0,
        rateLimitUntil: null,
      }),
    };
    const transport = {
      sendCampaignDelivery: sendError
        ? jest.fn().mockRejectedValue(sendError)
        : jest.fn().mockResolvedValue({ messageId: '55' }),
    };
    const userSocialRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 9, broadcastDisabledAt: null }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new BroadcastProcessorBase(
      broadcastService as any,
      { get: jest.fn().mockReturnValue(transport) } as any,
      userSocialRepository as any,
    );
    const job = {
      id: '17',
      data: {
        campaignId: 7,
        deliveryId: 12,
        social: SocialType.Telegram,
        targetSocialId: '42',
      },
      attemptsMade: 0,
      opts: { attempts: 2 },
      discard: jest.fn(),
    };

    return { processor, broadcastService, userSocialRepository, job };
  };

  it('delays a Telegram rate-limited delivery and pauses only broadcast work', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T10:00:00.000Z'));
    const error = new TelegramError({
      error_code: 429,
      description: 'Too Many Requests: retry after 5',
      parameters: { retry_after: 5 },
    });
    const { processor, broadcastService, job } = createProcessor(error);

    await expect(processor.handleSend(job as any)).rejects.toEqual(
      expect.objectContaining({
        name: BroadcastRateLimitError.name,
        retryAfterMs: 10_000,
      }),
    );

    expect(broadcastService.markDeliveryRetry).toHaveBeenCalledWith({
      deliveryId: 12,
      error: '429: Too Many Requests: retry after 5',
      retryAt: new Date('2026-09-03T10:00:10.000Z'),
    });
    expect(broadcastService.pauseTelegramQueueUntil).toHaveBeenCalledWith(
      new Date('2026-09-03T10:00:10.000Z'),
    );
    expect(broadcastService.markDeliveryFailed).not.toHaveBeenCalled();
    expect(job.discard).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('restores an unexpired Telegram pause before sending after a restart', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T10:00:00.000Z'));
    const { processor, broadcastService, job } = createProcessor(undefined, {
      rateLimitUntil: new Date('2026-09-03T10:00:10.000Z'),
    });

    await expect(processor.handleSend(job as any)).rejects.toEqual(
      expect.objectContaining({
        name: BroadcastRateLimitError.name,
        retryAfterMs: 10_000,
      }),
    );

    expect(broadcastService.pauseTelegramQueueUntil).toHaveBeenCalledWith(
      new Date('2026-09-03T10:00:10.000Z'),
    );
    expect(broadcastService.markDeliveryAttempt).not.toHaveBeenCalled();
    expect(broadcastService.markDeliveryRetry).toHaveBeenCalledWith({
      deliveryId: 12,
      error: 'Waiting for a previously requested Telegram retry_after',
      retryAt: new Date('2026-09-03T10:00:10.000Z'),
    });
    jest.useRealTimers();
  });

  it('keeps a final rate-limited delivery eligible for a later campaign retry', async () => {
    const error = new TelegramError({
      error_code: 429,
      description: 'Too Many Requests: retry after 5',
      parameters: { retry_after: 5 },
    });
    const { processor, broadcastService, job } = createProcessor(error);
    job.attemptsMade = 1;

    await expect(processor.handleSend(job as any)).rejects.toBe(error);

    expect(broadcastService.markDeliveryFailed).toHaveBeenCalledWith(
      12,
      '429: Too Many Requests: retry after 5',
      BroadcastDeliveryFailureKind.RateLimit,
    );
    expect(broadcastService.markDeliveryRetry).not.toHaveBeenCalled();
    expect(job.discard).toHaveBeenCalled();
  });

  it('marks only a blocked bot as blocked for future broadcasts', async () => {
    const { processor, broadcastService, userSocialRepository, job } =
      createProcessor(new Error('403: Forbidden: bot was blocked by the user'));

    await expect(processor.handleSend(job as any)).rejects.toThrow(
      'bot was blocked by the user',
    );

    expect(broadcastService.markDeliveryFailed).toHaveBeenCalledWith(
      12,
      '403: Forbidden: bot was blocked by the user',
      BroadcastDeliveryFailureKind.BlockedBot,
    );
    expect(userSocialRepository.update).toHaveBeenCalledWith(
      { social: SocialType.Telegram, socialId: 42 },
      { isBlockedBot: true },
    );
  });
});
