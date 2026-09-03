import { SocialType } from '@my-common/constants';

import { BroadcastService } from './broadcast.service';
import {
  BroadcastCampaignStatus,
  BroadcastDeliveryFailureKind,
  BroadcastDeliveryStatus,
  BroadcastMessageMode,
  getBroadcastFeedbackAfterClickMode,
} from './broadcast.types';

describe('BroadcastService', () => {
  const createService = () => {
    const campaignRepository = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        social: SocialType.Telegram,
        status: BroadcastCampaignStatus.Completed,
      }),
      update: jest.fn(),
    };
    const deliveryRepository = {
      count: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockResolvedValue([
        {
          id: 14,
          campaignId: 7,
          targetSocialId: '42',
          sentMessageId: '99',
          status: BroadcastDeliveryStatus.Sent,
          messageDeletedAt: null,
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 14,
        campaignId: 7,
        userSocialId: 12,
        campaign: {
          id: 7,
          social: SocialType.Telegram,
          feedbackButton: { text: '🫡' },
        },
      }),
      update: jest.fn(),
    };
    const transport = {
      deleteCampaignDelivery: jest.fn().mockResolvedValue(true),
    };
    const feedbackRepository = {
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn(),
    };
    const telegramBroadcastQueue = {
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BroadcastService(
      campaignRepository as any,
      deliveryRepository as any,
      feedbackRepository as any,
      telegramBroadcastQueue as any,
      {} as any,
      {} as any,
      { get: jest.fn().mockReturnValue(transport) } as any,
    );

    return {
      service,
      campaignRepository,
      deliveryRepository,
      feedbackRepository,
      transport,
      telegramBroadcastQueue,
    };
  };

  it('deletes only the selected deliveries of a campaign', async () => {
    const { service, deliveryRepository, transport } = createService();

    const result = await service.deleteCampaignMessages(7, {
      social: SocialType.Telegram,
      deliveryIds: [14],
    });

    expect(transport.deleteCampaignDelivery).toHaveBeenCalledWith({
      targetSocialId: '42',
      messageId: '99',
    });
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      14,
      expect.objectContaining({ messageDeleteError: null }),
    );
    expect(result).toEqual({
      campaignId: 7,
      deletedCount: 1,
      failedCount: 0,
      remainingCount: 1,
    });
  });

  it('does not treat an empty selected list as a request to delete all', async () => {
    const { service, deliveryRepository, transport } = createService();

    const result = await service.deleteCampaignMessages(7, {
      social: SocialType.Telegram,
      deliveryIds: [],
    });

    expect(transport.deleteCampaignDelivery).not.toHaveBeenCalled();
    expect(deliveryRepository.find).not.toHaveBeenCalled();
    expect(result).toEqual({
      campaignId: 7,
      deletedCount: 0,
      failedCount: 0,
      remainingCount: 1,
    });
  });

  it('paginates campaigns for the audience exclusion selector', async () => {
    const { service, campaignRepository } = createService();
    campaignRepository.count.mockResolvedValue(9);
    campaignRepository.find.mockResolvedValue([{ id: 8 }, { id: 7 }]);

    const result = await service.getCampaignsPage({
      social: SocialType.Telegram,
      page: 2,
      limit: 8,
    });

    expect(campaignRepository.find).toHaveBeenCalledWith({
      where: { social: SocialType.Telegram },
      order: { createdAt: 'DESC' },
      skip: 8,
      take: 8,
    });
    expect(result).toMatchObject({
      currentPage: 2,
      total: 9,
      totalPages: 2,
    });
  });

  it('marks a rate-limited delivery for retry without losing its error kind', async () => {
    const { service, deliveryRepository } = createService();
    const retryAt = new Date('2026-09-03T12:00:00.000Z');

    await service.markDeliveryRetry({
      deliveryId: 14,
      error: '429: Too Many Requests',
      retryAt,
    });

    expect(deliveryRepository.update).toHaveBeenCalledWith(14, {
      status: BroadcastDeliveryStatus.Retrying,
      error: '429: Too Many Requests',
      failureKind: BroadcastDeliveryFailureKind.RateLimit,
      retryAt,
    });
  });

  it('pauses only the Telegram worker until retry_after expires', async () => {
    jest.useFakeTimers();
    const { service, telegramBroadcastQueue } = createService();
    const retryAt = new Date(Date.now() + 5_000);

    await service.pauseTelegramQueueUntil(retryAt);

    expect(telegramBroadcastQueue.pause).toHaveBeenCalledWith(true, true);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(telegramBroadcastQueue.resume).toHaveBeenCalledWith(true);
    jest.useRealTimers();
  });

  it('estimates Telegram progress by actual outbound messages', () => {
    const { service } = createService();
    const estimate = service.getCampaignProgressEstimate(
      {
        social: SocialType.Telegram,
        mode: BroadcastMessageMode.Forward,
        feedbackButton: { text: 'Оценить' },
        totalCount: 30,
      } as any,
      {
        sentCount: 10,
        failedCount: 2,
        skippedCount: 3,
        retryingCount: 1,
        totalCount: 30,
        status: BroadcastCampaignStatus.Running,
        blockedBotCount: 1,
        deactivatedCount: 1,
        unavailableCount: 0,
        rateLimitCount: 0,
        rateLimitUntil: null,
      },
    );

    expect(estimate).toMatchObject({
      recipientsPerSecond: 5,
      messagesPerSecond: 10,
      remainingRecipients: 15,
      estimatedRemainingMs: 3_000,
    });
  });

  it('does not save feedback submitted by a different recipient', async () => {
    const { service, deliveryRepository, feedbackRepository } = createService();

    const result = await service.recordCampaignFeedback({
      deliveryId: 14,
      social: SocialType.Telegram,
      userSocialId: 15,
      action: 'initial',
    });

    expect(result).toBeNull();
    expect(feedbackRepository.findOne).not.toHaveBeenCalled();
    expect(feedbackRepository.save).not.toHaveBeenCalled();
    expect(deliveryRepository.findOne).toHaveBeenCalledWith({
      where: { id: 14 },
      relations: { campaign: true },
    });
  });

  it('returns a recipient action only for its delivery, transport and owner', async () => {
    const { service, deliveryRepository } = createService();
    deliveryRepository.findOne.mockResolvedValueOnce({
      id: 14,
      userSocialId: 12,
      campaign: {
        social: SocialType.Telegram,
        actionKeyboard: [{ type: 'select_group' }],
      },
    });

    const action = await service.getCampaignRecipientAction({
      deliveryId: 14,
      social: SocialType.Telegram,
      userSocialId: 12,
      action: 'select_group',
    });

    expect(action).toEqual({ type: 'select_group' });
  });

  it('does not return a recipient action to a different recipient', async () => {
    const { service } = createService();

    const action = await service.getCampaignRecipientAction({
      deliveryId: 14,
      social: SocialType.Telegram,
      userSocialId: 15,
      action: 'select_group',
    });

    expect(action).toBeNull();
  });

  it('adapts feedback behavior for campaigns created before the explicit mode', () => {
    expect(getBroadcastFeedbackAfterClickMode({ text: '🫡' })).toBe('delete');
    expect(
      getBroadcastFeedbackAfterClickMode({
        text: '🫡',
        afterClickText: 'Готово',
      }),
    ).toBe('replace');
    expect(
      getBroadcastFeedbackAfterClickMode({
        text: '🫡',
        afterClickMode: 'keep',
      }),
    ).toBe('keep');
  });

  it('adapts legacy campaign settings without source or delivery data', () => {
    const { service } = createService();
    const result = service.getCampaignSettingsForReuse({
      id: 7,
      mode: 'forward',
      audienceFilter: {
        groupNames: ['ЦИС-11'],
        onlyAuthorized: true,
      },
      feedbackButton: { text: '🫡' },
      actionKeyboard: { type: 'select_group' },
      sourceMessage: { text: 'Не переносить' },
      deliveries: [{ id: 14 }],
      status: BroadcastCampaignStatus.Completed,
    } as any);

    expect(result).toEqual({
      compatible: true,
      settings: {
        settingsVersion: 1,
        mode: 'forward',
        audienceFilter: {
          groupNames: ['ЦИС-11'],
          onlyAuthorized: true,
        },
        feedbackButton: { text: '🫡' },
        actionKeyboard: [{ type: 'select_group' }],
      },
    });
  });

  it('refuses campaign settings from an unknown schema', () => {
    const { service } = createService();

    const result = service.getCampaignSettingsForReuse({
      settingsVersion: 2,
    } as any);

    expect(result).toEqual({ compatible: false, settingsVersion: 2 });
  });

  it('records repeat feedback only after the initial click', async () => {
    const { service, deliveryRepository, feedbackRepository } = createService();
    deliveryRepository.findOne.mockResolvedValueOnce({
      id: 14,
      campaignId: 7,
      userSocialId: 12,
      campaign: {
        id: 7,
        social: SocialType.Telegram,
        feedbackButton: { text: '🫡', afterClickText: '✅' },
      },
    });
    feedbackRepository.findOne.mockResolvedValueOnce({ id: 88 });
    feedbackRepository.save.mockResolvedValue({ id: 89 });

    const result = await service.recordCampaignFeedback({
      deliveryId: 14,
      social: SocialType.Telegram,
      userSocialId: 12,
      action: 'repeat',
    });

    expect(result).toMatchObject({ created: true });
    expect(feedbackRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 7,
        deliveryId: 14,
        action: 'repeat',
      }),
    );
  });

  it('does not record repeat feedback when the campaign removes the button', async () => {
    const { service, feedbackRepository } = createService();

    const result = await service.recordCampaignFeedback({
      deliveryId: 14,
      social: SocialType.Telegram,
      userSocialId: 12,
      action: 'repeat',
    });

    expect(result).toBeNull();
    expect(feedbackRepository.findOne).not.toHaveBeenCalled();
    expect(feedbackRepository.save).not.toHaveBeenCalled();
  });

  it('returns the existing initial feedback on a concurrent duplicate click', async () => {
    const { service, feedbackRepository } = createService();
    feedbackRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 90 });
    feedbackRepository.save.mockRejectedValue({
      driverError: { code: '23505' },
    });

    const result = await service.recordCampaignFeedback({
      deliveryId: 14,
      social: SocialType.Telegram,
      userSocialId: 12,
      action: 'initial',
    });

    expect(result).toMatchObject({ feedback: { id: 90 }, created: false });
  });
});
