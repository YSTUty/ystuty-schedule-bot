import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Repository } from 'typeorm';

import { Job } from 'bull';
import { TelegramError } from 'telegraf-hardened';

import { isTelegramRateLimitError } from '@my-common';
import { SocialType } from '@my-common/constants';

import { UserSocial } from '../user/entity/user-social.entity';

import { BroadcastRateLimitError } from './broadcast-rate-limit.exception';
import { getTelegramBroadcastRateLimitBufferMs } from './broadcast.config';
import {
  BROADCAST_TELEGRAM_QUEUE_NAME,
  BROADCAST_VK_QUEUE_NAME,
} from './broadcast.constants';
import { BroadcastService } from './broadcast.service';
import {
  BroadcastDeliveryFailureKind,
  BroadcastJobData,
  normalizeBroadcastActionKeyboard,
} from './broadcast.types';
import { BroadcastTransportRegistry } from './transport/broadcast-transport.registry';

export class BroadcastProcessorBase {
  private readonly logger = new Logger(BroadcastProcessorBase.name);

  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly transportRegistry: BroadcastTransportRegistry,
    @InjectRepository(UserSocial)
    private readonly userSocialRepository: Repository<UserSocial>,
  ) {}

  async handleSend(job: Job<BroadcastJobData>) {
    const campaign = await this.broadcastService.getCampaign(
      job.data.campaignId,
    );
    if (!campaign) {
      throw new Error(`Broadcast campaign not found: ${job.data.campaignId}`);
    }

    await this.broadcastService.markCampaignRunning(campaign.id);
    let rateLimitEncountered = false;

    try {
      const campaignRateLimitWaitMs =
        campaign.social === SocialType.Telegram &&
        campaign.rateLimitUntil &&
        campaign.rateLimitUntil > new Date()
          ? campaign.rateLimitUntil.getTime() - Date.now()
          : null;
      if (campaignRateLimitWaitMs != null) {
        rateLimitEncountered = true;
        await this.broadcastService.pauseTelegramQueueUntil(
          campaign.rateLimitUntil!,
        );
        await this.broadcastService.markDeliveryRetry({
          deliveryId: job.data.deliveryId,
          error: 'Waiting for a previously requested Telegram retry_after',
          retryAt: campaign.rateLimitUntil!,
        });
        throw new BroadcastRateLimitError(
          campaignRateLimitWaitMs,
          'Waiting for a previously requested Telegram retry_after',
        );
      }

      await this.broadcastService.markDeliveryAttempt(job.data.deliveryId);
      const recipient = await this.userSocialRepository.findOne({
        where: {
          social: job.data.social,
          socialId: Number(job.data.targetSocialId),
        },
        select: { id: true, broadcastDisabledAt: true },
      });
      if (recipient?.broadcastDisabledAt) {
        await this.broadcastService.markDeliverySkipped(
          job.data.deliveryId,
          'Recipient disabled personal broadcasts',
        );
        return null;
      }

      const transport = this.transportRegistry.get(job.data.social);
      const result = await transport.sendCampaignDelivery({
        campaignId: campaign.id,
        deliveryId: job.data.deliveryId,
        targetSocialId: job.data.targetSocialId,
        mode: campaign.mode,
        sourceMessage: campaign.sourceMessage,
        actionKeyboard: normalizeBroadcastActionKeyboard(
          campaign.actionKeyboard,
        ),
        feedbackButton: campaign.feedbackButton,
      });

      await this.broadcastService.markDeliverySent(
        job.data.deliveryId,
        result.messageId,
      );
      return result.messageId;
    } catch (err) {
      if (err instanceof BroadcastRateLimitError) {
        throw err;
      }

      const message = this.getErrorMessage(err);
      const retryAfterMs = this.getTelegramRateLimitRetryAfterMs(
        job.data.social,
        err,
      );
      if (retryAfterMs != null) {
        rateLimitEncountered = true;
        const retryAt = new Date(Date.now() + retryAfterMs);
        await this.broadcastService.markCampaignRateLimited({
          campaignId: job.data.campaignId,
          retryAt,
          error: message,
        });
        await this.broadcastService.pauseTelegramQueueUntil(retryAt);
        this.logger.warn(
          `Broadcast delivery #${job.data.deliveryId} rate limited; retry at ${retryAt.toISOString()}`,
        );

        if (!this.hasRetryAttemptsLeft(job)) {
          job.discard();
          await this.broadcastService.markDeliveryFailed(
            job.data.deliveryId,
            message,
            BroadcastDeliveryFailureKind.RateLimit,
          );
          throw err;
        }

        await this.broadcastService.markDeliveryRetry({
          deliveryId: job.data.deliveryId,
          error: message,
          retryAt,
        });
        throw new BroadcastRateLimitError(retryAfterMs, message);
      }

      job.discard();
      const failureKind = this.getDeliveryFailureKind(message);
      await this.broadcastService.markDeliveryFailed(
        job.data.deliveryId,
        message,
        failureKind,
      );

      if (failureKind === BroadcastDeliveryFailureKind.BlockedBot) {
        await this.userSocialRepository.update(
          {
            social: job.data.social,
            socialId: Number(job.data.targetSocialId),
          },
          { isBlockedBot: true },
        );
      }

      throw err;
    } finally {
      const counters = await this.broadcastService.refreshCampaignCounters(
        job.data.campaignId,
      );
      const updatedCampaign = await this.broadcastService.getCampaign(
        job.data.campaignId,
      );
      if (updatedCampaign) {
        await this.updateProgressMessage(
          updatedCampaign,
          counters,
          rateLimitEncountered,
        );
      }
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job<BroadcastJobData>, result: string | null) {
    this.logger.debug(
      `Completed broadcast job ${job.id} for campaign #${job.data.campaignId}: ${result}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<BroadcastJobData>, err: Error) {
    if (err instanceof BroadcastRateLimitError) {
      this.logger.warn(
        `Delayed broadcast job ${job.id} for campaign #${job.data.campaignId}: ${err.message}`,
      );
      return;
    }
    this.logger.error(
      `Failed broadcast job ${job.id} for campaign #${job.data.campaignId}: ${err.message}`,
      err.stack,
    );
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'description' in err) {
      return String((err as { description: unknown }).description);
    }

    return String(err);
  }

  private hasRetryAttemptsLeft(job: Job<BroadcastJobData>) {
    return job.attemptsMade + 1 < (job.opts.attempts || 1);
  }

  private getTelegramRateLimitRetryAfterMs(social: SocialType, error: unknown) {
    if (
      social !== SocialType.Telegram ||
      !(error instanceof TelegramError) ||
      !isTelegramRateLimitError(error)
    ) {
      return null;
    }

    return (
      Math.max(1, error.parameters?.retry_after ?? 1) * 1e3 +
      getTelegramBroadcastRateLimitBufferMs()
    );
  }

  private getDeliveryFailureKind(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes('bot was blocked')) {
      return BroadcastDeliveryFailureKind.BlockedBot;
    }
    if (normalized.includes('user is deactivated')) {
      return BroadcastDeliveryFailureKind.Deactivated;
    }
    if (
      normalized.includes('bot was kicked') ||
      normalized.includes('chat not found') ||
      normalized.includes('peer_id')
    ) {
      return BroadcastDeliveryFailureKind.Unavailable;
    }
    return BroadcastDeliveryFailureKind.Other;
  }

  private async updateProgressMessage(
    campaign: Awaited<ReturnType<BroadcastService['getCampaign']>>,
    counters: Awaited<ReturnType<BroadcastService['refreshCampaignCounters']>>,
    force = false,
  ) {
    if (!campaign?.sourceMessage.reportMessage) return;

    const doneCount =
      counters.sentCount + counters.failedCount + counters.skippedCount;
    const finished = doneCount >= counters.totalCount;
    if (
      !force &&
      !this.broadcastService.shouldUpdateProgress({
        sourceMessage: campaign.sourceMessage,
        doneCount,
        totalCount: counters.totalCount,
        finished,
      })
    ) {
      return;
    }

    const transport = this.transportRegistry.get(campaign.social);
    if (!transport.updateCampaignProgress) return;
    const queueStatus = await this.broadcastService.getQueueStatus(
      campaign.social,
    );

    const estimate = this.broadcastService.getCampaignProgressEstimate(
      campaign,
      counters,
    );
    const text = [
      `<b>Рассылка #${campaign.id}</b>`,
      `Готово: <code>${doneCount}/${counters.totalCount}</code>`,
      `Успешно: <code>${counters.sentCount}</code>`,
      `Ошибки: <code>${counters.failedCount}</code>`,
      `Пропущено: <code>${counters.skippedCount}</code>`,
      ...(estimate
        ? [
            `Скорость: <code>до ${estimate.messagesPerSecond} сообщ./с (${estimate.recipientsPerSecond} получ./с)</code>`,
            `Осталось: <code>~${this.formatDuration(estimate.estimatedRemainingMs)}</code>`,
          ]
        : []),
      `Rate limit: <code>${
        counters.rateLimitCount
          ? estimate?.rateLimitWaitingMs
            ? `⚠️ пауза ещё ${this.formatDuration(estimate.rateLimitWaitingMs)}`
            : `был (${counters.rateLimitCount})`
          : 'не было'
      }</code>`,
      `Недоступны: <code>заблокировали ${counters.blockedBotCount}, деактивированы ${counters.deactivatedCount}, прочее ${counters.unavailableCount}</code>`,
      `Статус: <code>${counters.status}</code>`,
    ].join('\n');

    const updated = await transport.updateCampaignProgress({
      reportMessage: campaign.sourceMessage.reportMessage,
      status: counters.status,
      paused: queueStatus.paused,
      text,
    });
    if (updated) {
      await this.broadcastService.markProgressUpdated(campaign, doneCount);
    }
  }

  private formatDuration(durationMs: number) {
    const totalSeconds = Math.max(0, Math.ceil(durationMs / 1e3));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      ...(hours ? [`${hours}ч`] : []),
      ...(minutes || hours ? [`${minutes}м`] : []),
      `${seconds}с`,
    ].join(' ');
  }
}

@Processor(BROADCAST_TELEGRAM_QUEUE_NAME)
export class TelegramBroadcastProcessor extends BroadcastProcessorBase {
  @Process({ name: 'send', concurrency: 1 })
  async handleTelegramSend(job: Job<BroadcastJobData>) {
    return await this.handleSend(job);
  }
}

@Processor(BROADCAST_VK_QUEUE_NAME)
export class VkBroadcastProcessor extends BroadcastProcessorBase {
  @Process({ name: 'send', concurrency: 1 })
  async handleVkSend(job: Job<BroadcastJobData>) {
    return await this.handleSend(job);
  }
}
