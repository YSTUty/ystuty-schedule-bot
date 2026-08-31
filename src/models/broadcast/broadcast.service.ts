import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { In, IsNull, Not, Repository } from 'typeorm';

import { Queue } from 'bull';

import { SocialType } from '@my-common/constants';
import { UserException } from '@my-common/exception';

import { getBroadcastHistoryLimit } from './broadcast.config';
import {
  BROADCAST_CAMPAIGN_SETTINGS_VERSION,
  BROADCAST_TELEGRAM_QUEUE_NAME,
  BROADCAST_VK_QUEUE_NAME,
  DEFAULT_BROADCAST_JOB_DELAY_MS,
  DEFAULT_BROADCAST_PROGRESS_INTERVAL_MS,
  DEFAULT_BROADCAST_PROGRESS_STEP,
} from './broadcast.constants';
import {
  BroadcastActionKeyboard,
  BroadcastAudienceFilter,
  BroadcastAudienceGroupsPreview,
  BroadcastCampaignSettingsReuse,
  BroadcastCampaignStatus,
  BroadcastDeliveryStatus,
  BroadcastFeedbackAction,
  BroadcastFeedbackButton,
  BroadcastJobData,
  BroadcastMessageMode,
  BroadcastRecipientAction,
  BroadcastRecipientActionButton,
  BroadcastSourceMessage,
  getBroadcastFeedbackAfterClickMode,
  normalizeBroadcastActionKeyboard,
} from './broadcast.types';
import { BroadcastCampaign } from './entity/broadcast-campaign.entity';
import { BroadcastDelivery } from './entity/broadcast-delivery.entity';
import { BroadcastFeedback } from './entity/broadcast-feedback.entity';
import { BroadcastAudienceFilterService } from './filter/broadcast-audience-filter.service';
import { BroadcastTransportRegistry } from './transport/broadcast-transport.registry';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    @InjectRepository(BroadcastCampaign)
    private readonly campaignRepository: Repository<BroadcastCampaign>,
    @InjectRepository(BroadcastDelivery)
    private readonly deliveryRepository: Repository<BroadcastDelivery>,
    @InjectRepository(BroadcastFeedback)
    private readonly feedbackRepository: Repository<BroadcastFeedback>,
    @InjectQueue(BROADCAST_TELEGRAM_QUEUE_NAME)
    private readonly telegramBroadcastQueue: Queue<BroadcastJobData>,
    @InjectQueue(BROADCAST_VK_QUEUE_NAME)
    private readonly vkBroadcastQueue: Queue<BroadcastJobData>,
    private readonly audienceFilterService: BroadcastAudienceFilterService,
    private readonly transportRegistry: BroadcastTransportRegistry,
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

  public async getActiveCampaign(social: SocialType) {
    return await this.campaignRepository.findOne({
      where: [
        { social, status: BroadcastCampaignStatus.Queued },
        { social, status: BroadcastCampaignStatus.Running },
      ],
      order: { createdAt: 'DESC' },
    });
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

  public async getGroupsPreview(
    social: SocialType,
    filter: BroadcastAudienceFilter = {},
  ): Promise<BroadcastAudienceGroupsPreview> {
    return await this.audienceFilterService.getGroupsPreview(social, filter);
  }

  public async createAndQueueCampaign(params: {
    social: SocialType;
    mode: BroadcastMessageMode;
    sourceMessage: BroadcastSourceMessage;
    audienceFilter?: BroadcastAudienceFilter;
    recipientUserSocialIds?: number[];
    feedbackButton?: BroadcastFeedbackButton | null;
    actionKeyboard?: BroadcastActionKeyboard | null;
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
        settingsVersion: BROADCAST_CAMPAIGN_SETTINGS_VERSION,
        sourceMessage: params.sourceMessage,
        audienceFilter,
        contentPreview: this.createContentPreview(params.sourceMessage),
        feedbackButton: params.feedbackButton || null,
        actionKeyboard: normalizeBroadcastActionKeyboard(params.actionKeyboard),
        createdBySocialId:
          params.createdBySocialId == null
            ? null
            : String(params.createdBySocialId),
        totalCount: recipients.length,
      }),
    );

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
    return await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
  }

  public async getCampaignForSocial(campaignId: number, social: SocialType) {
    return await this.campaignRepository.findOne({
      where: { id: campaignId, social },
    });
  }

  /**
   * Возвращает только переносимые настройки кампании.
   * Образец сообщения, deliveries, статус и прочая история намеренно не входят.
   */
  public getCampaignSettingsForReuse(
    campaign: BroadcastCampaign,
  ): BroadcastCampaignSettingsReuse {
    const settingsVersion = campaign.settingsVersion ?? 0;
    if (
      settingsVersion !== 0 &&
      settingsVersion !== BROADCAST_CAMPAIGN_SETTINGS_VERSION
    ) {
      return { compatible: false, settingsVersion };
    }

    return {
      compatible: true,
      settings: {
        // Кампании без поля созданы до введения версии. Этот adapter сохраняет
        // только уже поддерживаемые поля и приводит legacy actionKeyboard.
        settingsVersion: BROADCAST_CAMPAIGN_SETTINGS_VERSION,
        mode: campaign.mode,
        audienceFilter: { ...campaign.audienceFilter },
        feedbackButton: campaign.feedbackButton
          ? { ...campaign.feedbackButton }
          : null,
        actionKeyboard: normalizeBroadcastActionKeyboard(
          campaign.actionKeyboard,
        ),
      },
    };
  }

  public async getRecentCampaigns(social: SocialType, limit = 10) {
    return await this.campaignRepository.find({
      where: { social },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(limit, 20)),
    });
  }

  /** Возвращает страницу истории кампаний для интерактивного выбора фильтра. */
  public async getCampaignsPage(params: {
    social: SocialType;
    page?: number;
    limit?: number;
  }) {
    const safeLimit = Math.max(1, Math.min(params.limit || 8, 20));
    const total = await this.campaignRepository.count({
      where: { social: params.social },
    });
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const currentPage = Math.min(Math.max(1, params.page || 1), totalPages);
    const items = await this.campaignRepository.find({
      where: { social: params.social },
      order: { createdAt: 'DESC' },
      skip: (currentPage - 1) * safeLimit,
      take: safeLimit,
    });

    return { items, total, currentPage, totalPages, limit: safeLimit };
  }

  public async getCampaignMessageDeliveriesPage(params: {
    campaignId: number;
    social: SocialType;
    page?: number;
    limit?: number;
  }) {
    const campaign = await this.getCampaignForSocial(
      params.campaignId,
      params.social,
    );
    if (!campaign) return null;

    const safeLimit = Math.max(1, Math.min(params.limit || 8, 20));
    const requestedPage = Math.max(1, params.page || 1);
    const where = {
      campaignId: campaign.id,
      sentMessageId: Not(IsNull()),
      messageDeletedAt: IsNull(),
    };
    const total = await this.deliveryRepository.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const currentPage = Math.min(requestedPage, totalPages);
    const items = await this.deliveryRepository.find({
      where,
      relations: { userSocial: true },
      order: { id: 'ASC' },
      skip: (currentPage - 1) * safeLimit,
      take: safeLimit,
    });

    return { items, total, currentPage, totalPages, limit: safeLimit };
  }

  public async deleteCampaignMessages(
    campaignId: number,
    socialOrOptions?:
      | SocialType
      | { social?: SocialType; deliveryIds?: number[] },
  ) {
    const options =
      typeof socialOrOptions === 'string'
        ? { social: socialOrOptions }
        : socialOrOptions || {};
    const campaign = options.social
      ? await this.getCampaignForSocial(campaignId, options.social)
      : await this.campaignRepository.findOne({
          where: { id: campaignId },
        });
    if (!campaign) return null;

    if (
      [
        BroadcastCampaignStatus.Queued,
        BroadcastCampaignStatus.Running,
      ].includes(campaign.status)
    ) {
      await this.terminateActiveCampaigns(campaign.social);
    }

    const hasDeliverySelection = Array.isArray(options.deliveryIds);
    const deliveryIds = options.deliveryIds?.filter(
      (deliveryId) => Number.isInteger(deliveryId) && deliveryId > 0,
    );
    const deliveries =
      hasDeliverySelection && !deliveryIds?.length
        ? []
        : await this.deliveryRepository.find({
            where: {
              campaignId,
              sentMessageId: Not(IsNull()),
              messageDeletedAt: IsNull(),
              ...(hasDeliverySelection ? { id: In(deliveryIds!) } : {}),
            },
          });
    const transport = this.transportRegistry.get(campaign.social);
    let deletedCount = 0;
    let failedCount = 0;

    for (const delivery of deliveries) {
      try {
        const deleted = await transport.deleteCampaignDelivery({
          targetSocialId: delivery.targetSocialId,
          messageId: delivery.sentMessageId!,
        });
        if (deleted) {
          deletedCount += 1;
          await this.deliveryRepository.update(delivery.id, {
            messageDeletedAt: new Date(),
            messageDeleteError: null,
          });
          continue;
        }

        failedCount += 1;
        await this.deliveryRepository.update(delivery.id, {
          messageDeleteError: 'Transport did not delete the message',
        });
      } catch (err) {
        failedCount += 1;
        const message = err instanceof Error ? err.message : String(err);
        await this.deliveryRepository.update(delivery.id, {
          messageDeleteError: message.slice(0, 2000),
        });
        this.logger.warn(
          `Could not delete broadcast delivery #${delivery.id}: ${message}`,
        );
      }
    }

    const remainingCount = await this.deliveryRepository.count({
      where: {
        campaignId: campaign.id,
        sentMessageId: Not(IsNull()),
        messageDeletedAt: IsNull(),
      },
    });
    if (remainingCount === 0) {
      await this.campaignRepository.update(campaign.id, {
        messagesDeletedAt: new Date(),
      });
    }

    return { campaignId, deletedCount, failedCount, remainingCount };
  }

  public async updateCampaignSourceMessage(
    campaignId: number,
    sourceMessage: BroadcastSourceMessage,
  ) {
    await this.campaignRepository.update(campaignId, { sourceMessage });
  }

  /** Сохраняет feedback только от получателя конкретной доставки. */
  public async recordCampaignFeedback(params: {
    deliveryId: number;
    social: SocialType;
    userSocialId?: number | null;
    action: BroadcastFeedbackAction;
  }) {
    if (params.userSocialId == null) return null;

    const delivery = await this.deliveryRepository.findOne({
      where: { id: params.deliveryId },
      relations: { campaign: true },
    });
    const campaign = delivery?.campaign;
    if (
      !delivery ||
      !campaign ||
      campaign.social !== params.social ||
      !campaign.feedbackButton ||
      delivery.userSocialId !== params.userSocialId
    ) {
      return null;
    }

    if (params.action === 'initial') {
      const existing = await this.feedbackRepository.findOne({
        where: { deliveryId: delivery.id, action: 'initial' },
      });
      if (existing) {
        return {
          feedback: existing,
          created: false,
          feedbackButton: campaign.feedbackButton,
          actionKeyboard: normalizeBroadcastActionKeyboard(
            campaign.actionKeyboard,
          ),
        };
      }
    } else {
      if (
        getBroadcastFeedbackAfterClickMode(campaign.feedbackButton) === 'delete'
      ) {
        return null;
      }

      const initialFeedback = await this.feedbackRepository.findOne({
        where: { deliveryId: delivery.id, action: 'initial' },
      });
      if (!initialFeedback) return null;
    }

    try {
      const feedback = await this.feedbackRepository.save(
        this.feedbackRepository.create({
          campaignId: campaign.id,
          deliveryId: delivery.id,
          social: params.social,
          userSocialId: delivery.userSocialId,
          action: params.action,
        }),
      );
      return {
        feedback,
        created: true,
        feedbackButton: campaign.feedbackButton,
        actionKeyboard: normalizeBroadcastActionKeyboard(
          campaign.actionKeyboard,
        ),
      };
    } catch (err) {
      if (params.action !== 'initial' || !this.isUniqueViolation(err)) {
        throw err;
      }

      const feedback = await this.feedbackRepository.findOne({
        where: { deliveryId: delivery.id, action: 'initial' },
      });
      return feedback
        ? {
            feedback,
            created: false,
            feedbackButton: campaign.feedbackButton,
            actionKeyboard: normalizeBroadcastActionKeyboard(
              campaign.actionKeyboard,
            ),
          }
        : null;
    }
  }

  /** Возвращает действие только для доставки текущего получателя в нужном transport. */
  public async getCampaignRecipientAction(params: {
    deliveryId: number;
    social: SocialType;
    userSocialId?: number | null;
    action: BroadcastRecipientAction;
  }) {
    if (params.userSocialId == null) return null;

    const delivery = await this.deliveryRepository.findOne({
      where: { id: params.deliveryId },
      relations: { campaign: true },
    });
    const actionKeyboard = normalizeBroadcastActionKeyboard(
      delivery?.campaign?.actionKeyboard,
    );
    const actionButton = actionKeyboard.find(
      (item): item is BroadcastRecipientActionButton =>
        item.type === params.action,
    );
    if (
      !delivery ||
      delivery.campaign.social !== params.social ||
      delivery.userSocialId !== params.userSocialId ||
      !actionButton
    ) {
      return null;
    }

    return actionButton;
  }

  private isUniqueViolation(err: unknown) {
    return (
      typeof err === 'object' &&
      err != null &&
      'driverError' in err &&
      typeof (err as { driverError?: { code?: unknown } }).driverError ===
        'object' &&
      (err as { driverError: { code?: unknown } }).driverError.code === '23505'
    );
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

  /** Помечает неотправленную delivery пропущенной без повторной попытки. */
  public async markDeliverySkipped(deliveryId: number, reason: string) {
    await this.deliveryRepository.update(deliveryId, {
      status: BroadcastDeliveryStatus.Skipped,
      error: reason.slice(0, 2000),
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

  private createContentPreview(sourceMessage: BroadcastSourceMessage) {
    const text = sourceMessage.text?.replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 500);
    if (sourceMessage.stickerId) return `Стикер #${sourceMessage.stickerId}`;
    if (sourceMessage.attachment) return 'Сообщение с вложением';
    return 'Сообщение без текстового содержимого';
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
