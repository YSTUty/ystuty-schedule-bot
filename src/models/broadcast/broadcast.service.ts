import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';

import { Queue } from 'bull';

import { SocialType } from '@my-common/constants';

import { getBroadcastHistoryLimit } from './broadcast.config';
import {
  BROADCAST_QUEUE_NAME,
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
    @InjectQueue(BROADCAST_QUEUE_NAME)
    private readonly broadcastQueue: Queue<BroadcastJobData>,
    private readonly audienceFilterService: BroadcastAudienceFilterService,
  ) {}

  public async assertCanStartCampaign(social: SocialType) {
    const [activeCount, waitingCount, delayedCount] = await Promise.all([
      this.broadcastQueue.getActiveCount(),
      this.broadcastQueue.getWaitingCount(),
      this.broadcastQueue.getDelayedCount(),
    ]);
    if (activeCount + waitingCount + delayedCount > 0) {
      throw new Error('Another broadcast is already running');
    }

    const runningCampaign = await this.campaignRepository.findOne({
      where: [
        { social, status: BroadcastCampaignStatus.Queued },
        { social, status: BroadcastCampaignStatus.Running },
      ],
    });
    if (runningCampaign) {
      throw new Error(`Broadcast campaign #${runningCampaign.id} is active`);
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

  public async createAndQueueCampaign(params: {
    social: SocialType;
    mode: BroadcastMessageMode;
    sourceMessage: BroadcastSourceMessage;
    audienceFilter?: BroadcastAudienceFilter;
    createdBySocialId?: string | number | null;
  }) {
    await this.assertCanStartCampaign(params.social);

    const audienceFilter = this.audienceFilterService.normalizeFilter(
      params.social,
      params.audienceFilter,
    );
    const recipients = await this.audienceFilterService.getRecipients(
      params.social,
      audienceFilter,
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

    await this.broadcastQueue.pause();

    for (const delivery of deliveries) {
      await this.broadcastQueue.add(
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

  public async terminateActiveCampaigns() {
    await this.broadcastQueue.pause();
    await Promise.all([
      this.broadcastQueue.empty(),
      this.broadcastQueue.clean(0, 'delayed'),
      this.broadcastQueue.clean(0, 'wait'),
      this.broadcastQueue.clean(0, 'active'),
    ]);
    await this.campaignRepository.update(
      { status: BroadcastCampaignStatus.Queued },
      { status: BroadcastCampaignStatus.Terminated },
    );
    await this.campaignRepository.update(
      { status: BroadcastCampaignStatus.Running },
      { status: BroadcastCampaignStatus.Terminated },
    );
    await this.broadcastQueue.resume();
  }

  public async pauseQueue() {
    await this.broadcastQueue.pause();
  }

  public async resumeQueue() {
    await this.broadcastQueue.resume();
  }

  public async getQueueStatus() {
    const [active, waiting, delayed, failed, completed, paused] =
      await Promise.all([
        this.broadcastQueue.getActiveCount(),
        this.broadcastQueue.getWaitingCount(),
        this.broadcastQueue.getDelayedCount(),
        this.broadcastQueue.getFailedCount(),
        this.broadcastQueue.getCompletedCount(),
        this.broadcastQueue.isPaused(),
      ]);

    return { active, waiting, delayed, failed, completed, paused };
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
