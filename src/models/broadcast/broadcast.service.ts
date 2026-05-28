import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';

import { Queue } from 'bull';

import { SocialType } from '@my-common/constants';
import { UserException } from '@my-common/exception';

import { getBroadcastHistoryLimit } from './broadcast.config';
import {
  BROADCAST_TELEGRAM_QUEUE_NAME,
  BROADCAST_VK_QUEUE_NAME,
  DEFAULT_BROADCAST_JOB_DELAY_MS,
  DEFAULT_BROADCAST_PROGRESS_INTERVAL_MS,
  DEFAULT_BROADCAST_PROGRESS_STEP,
} from './broadcast.constants';
import {
  BroadcastAudienceFilter,
  BroadcastCampaignStatus,
  BroadcastDeliveryStatus,
  BroadcastJobData,
  BroadcastMessageMode,
  BroadcastSourceMessage,
} from './broadcast.types';
import { BroadcastCampaign } from './entity/broadcast-campaign.entity';
import { BroadcastDelivery } from './entity/broadcast-delivery.entity';
import { BroadcastAudienceFilterService } from './filter/broadcast-audience-filter.service';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    @InjectRepository(BroadcastCampaign)
    private readonly campaignRepository: Repository<BroadcastCampaign>,
    @InjectRepository(BroadcastDelivery)
    private readonly deliveryRepository: Repository<BroadcastDelivery>,
    @InjectQueue(BROADCAST_TELEGRAM_QUEUE_NAME)
    private readonly telegramBroadcastQueue: Queue<BroadcastJobData>,
    @InjectQueue(BROADCAST_VK_QUEUE_NAME)
    private readonly vkBroadcastQueue: Queue<BroadcastJobData>,
    private readonly audienceFilterService: BroadcastAudienceFilterService,
  ) {}

  public async assertCanStartCampaign(social: SocialType) {
    const [activeCount, waitingCount, delayedCount] = await Promise.all([
      this.getQueue(social).getActiveCount(),
      this.getQueue(social).getWaitingCount(),
      this.getQueue(social).getDelayedCount(),
    ]);
    if (activeCount + waitingCount + delayedCount > 0) {
      throw new UserException('Another broadcast is already running');
    }

    const runningCampaign = await this.campaignRepository.findOne({
      where: [
        { social, status: BroadcastCampaignStatus.Queued },
        { social, status: BroadcastCampaignStatus.Running },
      ],
    });
    if (runningCampaign) {
      throw new UserException(
        `Broadcast campaign #${runningCampaign.id} is active`,
      );
    }
  }

  public async countRecipients(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
  ) {
    const recipients = await this.audienceFilterService.getRecipients(
      social,
      filter,
    );
    return recipients.length;
  }

  public async getRecipientsPage(params: {
    social: SocialType;
    filter?: BroadcastAudienceFilter;
    page?: number;
    limit?: number;
  }) {
    return await this.audienceFilterService.getRecipientsPage(
      params.social,
      params.filter,
      params.page,
      params.limit,
    );
  }

  public async createAndQueueCampaign(params: {
    social: SocialType;
    mode: BroadcastMessageMode;
    sourceMessage: BroadcastSourceMessage;
    audienceFilter?: BroadcastAudienceFilter;
    recipientUserSocialIds?: number[];
    createdBySocialId?: string | number | null;
  }) {
    await this.assertCanStartCampaign(params.social);

    const audienceFilter = this.audienceFilterService.normalizeFilter(
      params.social,
      params.audienceFilter,
    );
    const recipients = await this.audienceFilterService.getRecipients(
      params.social,
      params.recipientUserSocialIds?.length
        ? {
            ...audienceFilter,
            userSocialIds: params.recipientUserSocialIds,
          }
        : audienceFilter,
    );

    const campaign = await this.campaignRepository.save(
      this.campaignRepository.create({
        social: params.social,
        status: BroadcastCampaignStatus.Queued,
        mode: params.mode,
        sourceMessage: params.sourceMessage,
        audienceFilter,
        createdBySocialId:
          params.createdBySocialId == null
            ? null
            : String(params.createdBySocialId),
        totalCount: recipients.length,
      }),
    );

    await this.pruneHistory();

    const deliveries = await this.deliveryRepository.save(
      recipients.map((recipient) =>
        this.deliveryRepository.create({
          campaignId: campaign.id,
          userSocialId: recipient.id,
          targetSocialId: String(recipient.socialId),
          status: BroadcastDeliveryStatus.Queued,
        }),
      ),
    );

    if (!deliveries.length) {
      await this.campaignRepository.update(campaign.id, {
        status: BroadcastCampaignStatus.Completed,
      });
      campaign.status = BroadcastCampaignStatus.Completed;
      return campaign;
    }

    const queue = this.getQueue(params.social);
    await queue.pause();

    for (const delivery of deliveries) {
      await queue.add(
        'send',
        {
          campaignId: campaign.id,
          deliveryId: delivery.id,
          social: params.social,
          targetSocialId: delivery.targetSocialId,
        },
        {
          attempts: 1,
          delay: DEFAULT_BROADCAST_JOB_DELAY_MS,
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    }

    this.logger.log(
      `Queued broadcast campaign #${campaign.id} for ${deliveries.length} recipients`,
    );

    return campaign;
  }

  public async markCampaignRunning(campaignId: number) {
    await this.campaignRepository.update(
      { id: campaignId, status: BroadcastCampaignStatus.Queued },
      { status: BroadcastCampaignStatus.Running },
    );
  }

  public async getCampaign(campaignId: number) {
    return await this.campaignRepository.findOne({ id: campaignId });
  }

  public async updateCampaignSourceMessage(
    campaignId: number,
    sourceMessage: BroadcastSourceMessage,
  ) {
    await this.campaignRepository.update(campaignId, { sourceMessage });
  }

  public async markDeliverySent(
    deliveryId: number,
    sentMessageId?: string | null,
  ) {
    await this.deliveryRepository.update(deliveryId, {
      status: BroadcastDeliveryStatus.Sent,
      sentMessageId: sentMessageId ?? null,
      error: null,
    });
  }

  public async markDeliveryFailed(deliveryId: number, error: string) {
    await this.deliveryRepository.update(deliveryId, {
      status: BroadcastDeliveryStatus.Failed,
      error: error.slice(0, 2000),
    });
  }

  public async refreshCampaignCounters(campaignId: number) {
    const [sentCount, failedCount, skippedCount, totalCount] =
      await Promise.all([
        this.deliveryRepository.count({
          where: { campaignId, status: BroadcastDeliveryStatus.Sent },
        }),
        this.deliveryRepository.count({
          where: { campaignId, status: BroadcastDeliveryStatus.Failed },
        }),
        this.deliveryRepository.count({
          where: { campaignId, status: BroadcastDeliveryStatus.Skipped },
        }),
        this.deliveryRepository.count({ where: { campaignId } }),
      ]);

    const status =
      sentCount + failedCount + skippedCount >= totalCount
        ? BroadcastCampaignStatus.Completed
        : BroadcastCampaignStatus.Running;

    await this.campaignRepository.update(campaignId, {
      sentCount,
      failedCount,
      skippedCount,
      totalCount,
      status,
    });

    return { sentCount, failedCount, skippedCount, totalCount, status };
  }

  public shouldUpdateProgress(params: {
    sourceMessage: BroadcastSourceMessage;
    doneCount: number;
    totalCount: number;
    finished: boolean;
  }) {
    const reportMessage = params.sourceMessage.reportMessage;
    if (!reportMessage) return false;
    if (params.finished) return true;

    const now = Date.now();
    const lastUpdatedAt = reportMessage.lastUpdatedAt ?? 0;
    const lastDoneCount = reportMessage.lastDoneCount ?? 0;

    return (
      now - lastUpdatedAt >= DEFAULT_BROADCAST_PROGRESS_INTERVAL_MS &&
      params.doneCount - lastDoneCount >= DEFAULT_BROADCAST_PROGRESS_STEP
    );
  }

  public async markProgressUpdated(
    campaign: BroadcastCampaign,
    doneCount: number,
  ) {
    if (!campaign.sourceMessage.reportMessage) return;

    campaign.sourceMessage.reportMessage.lastUpdatedAt = Date.now();
    campaign.sourceMessage.reportMessage.lastDoneCount = doneCount;
    await this.updateCampaignSourceMessage(campaign.id, campaign.sourceMessage);
  }

  public async terminateActiveCampaigns(social: SocialType) {
    const queue = this.getQueue(social);
    await queue.pause();
    await Promise.all([
      queue.empty(),
      queue.clean(0, 'delayed'),
      queue.clean(0, 'wait'),
      queue.clean(0, 'active'),
    ]);
    await this.campaignRepository.update(
      { social, status: BroadcastCampaignStatus.Queued },
      { status: BroadcastCampaignStatus.Terminated },
    );
    await this.campaignRepository.update(
      { social, status: BroadcastCampaignStatus.Running },
      { status: BroadcastCampaignStatus.Terminated },
    );
    await queue.resume();
  }

  public async pauseQueue(social: SocialType) {
    await this.getQueue(social).pause();
  }

  public async resumeQueue(social: SocialType) {
    await this.getQueue(social).resume();
  }

  public async getQueueStatus(social: SocialType) {
    const queue = this.getQueue(social);
    const [active, waiting, delayed, failed, completed, paused] =
      await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getDelayedCount(),
        queue.getFailedCount(),
        queue.getCompletedCount(),
        queue.isPaused(),
      ]);

    return {
      active,
      waiting,
      delayed,
      failed,
      completed,
      paused,
      hasPending: active + waiting + delayed > 0,
    };
  }

  private getQueue(social: SocialType): Queue<BroadcastJobData> {
    return social === SocialType.Telegram
      ? this.telegramBroadcastQueue
      : this.vkBroadcastQueue;
  }

  private async pruneHistory() {
    const limit = getBroadcastHistoryLimit();
    if (!limit) return;

    const campaigns = await this.campaignRepository.find({
      order: { createdAt: 'DESC' },
      skip: limit,
    });

    if (!campaigns.length) return;

    await this.campaignRepository.remove(campaigns);
  }
}
