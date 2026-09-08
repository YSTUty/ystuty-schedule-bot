import { Logger } from '@nestjs/common';
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';

import { Job } from 'bull';
import { TelegramError } from 'telegraf-hardened';
import { APIError } from 'vk-io';

import { isTelegramRateLimitError } from '@my-common';
import { SocialType } from '@my-common/constants';

import { ScheduleNotifDeliveryService } from './schedule-notif-delivery.service';
import { type ScheduleNotifJobData } from './schedule-notif-queue.service';
import { ScheduleNotifRateLimitError } from './schedule-notif-rate-limit.exception';
import {
  SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS,
  SCHEDULE_NOTIF_TELEGRAM_QUEUE_NAME,
  SCHEDULE_NOTIF_VK_QUEUE_NAME,
} from './schedule-notif.constants';

class ScheduleNotifProcessorBase {
  private readonly logger = new Logger(ScheduleNotifProcessorBase.name);

  constructor(private readonly deliveryService: ScheduleNotifDeliveryService) {}

  protected async handleDelivery(job: Job<ScheduleNotifJobData>) {
    const deliveryContext =
      await this.deliveryService.getPendingDeliveryForProcessing(
        job.data.deliveryId,
      );
    if (!deliveryContext) return null;

    const { notif, delivery } = deliveryContext;
    if (delivery.notifId !== job.data.notifId) {
      job.discard();
      await this.deliveryService.markFailed(
        notif,
        delivery,
        'Schedule notification job does not match its delivery',
      );
      return null;
    }
    if (
      delivery.scheduledFor.getTime() + SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS <
      Date.now()
    ) {
      await this.deliveryService.markSkipped(
        notif,
        delivery,
        'Notification delivery expired before it was sent',
      );
      return null;
    }

    try {
      const result = await this.deliveryService.deliver(notif, delivery);
      return result.sentMessageId;
    } catch (error) {
      const errorText = this.getErrorText(error);
      const retryAfterMs = this.getRateLimitRetryAfterMs(
        notif.transport,
        error,
      );

      if (retryAfterMs != null) {
        if (!this.hasRetryAttemptsLeft(job)) {
          job.discard();
          await this.deliveryService.markFailed(notif, delivery, errorText);
          return null;
        }
        await this.deliveryService.markRetry(delivery, errorText);
        throw new ScheduleNotifRateLimitError(retryAfterMs, errorText);
      }
      if (this.isRetryable(error)) {
        if (!this.hasRetryAttemptsLeft(job)) {
          job.discard();
          await this.deliveryService.markFailed(notif, delivery, errorText);
          return null;
        }
        await this.deliveryService.markRetry(delivery, errorText);
        throw error;
      }

      job.discard();
      await this.deliveryService.markFailed(notif, delivery, errorText);
      return null;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<ScheduleNotifJobData>, error: Error) {
    const retrying = job.attemptsMade < (job.opts.attempts || 1);
    const message = `Schedule notif delivery #${job.data.deliveryId} failed`;
    if (retrying) {
      this.logger.warn(`${message}; retry scheduled: ${error.message}`);
      return;
    }
    this.logger.error(
      `${message}; retries exhausted: ${error.message}`,
      error.stack,
    );
  }

  private getRateLimitRetryAfterMs(transport: SocialType, error: unknown) {
    if (
      transport === SocialType.Telegram &&
      error instanceof TelegramError &&
      isTelegramRateLimitError(error)
    ) {
      return Math.max(1, error.parameters?.retry_after ?? 1) * 1e3 + 3e3;
    }
    if (
      transport === SocialType.Vkontakte &&
      error instanceof APIError &&
      error.code === 6
    ) {
      return 5e3;
    }
    return null;
  }

  private isRetryable(error: unknown) {
    if (error instanceof TelegramError) {
      return error.code === 429 || error.code >= 500;
    }
    if (error instanceof APIError) {
      return error.code === 6 || error.code === 10;
    }
    return true;
  }

  private hasRetryAttemptsLeft(job: Job<ScheduleNotifJobData>) {
    return job.attemptsMade + 1 < (job.opts.attempts || 1);
  }

  private getErrorText(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error && 'description' in error) {
      return String((error as { description: unknown }).description);
    }
    return String(error);
  }
}

@Processor(SCHEDULE_NOTIF_TELEGRAM_QUEUE_NAME)
export class TelegramScheduleNotifProcessor extends ScheduleNotifProcessorBase {
  constructor(deliveryService: ScheduleNotifDeliveryService) {
    super(deliveryService);
  }

  @Process({ name: 'deliver', concurrency: 1 })
  async handleTelegramDelivery(job: Job<ScheduleNotifJobData>) {
    return await this.handleDelivery(job);
  }
}

@Processor(SCHEDULE_NOTIF_VK_QUEUE_NAME)
export class VkScheduleNotifProcessor extends ScheduleNotifProcessorBase {
  constructor(deliveryService: ScheduleNotifDeliveryService) {
    super(deliveryService);
  }

  @Process({ name: 'deliver', concurrency: 1 })
  async handleVkDelivery(job: Job<ScheduleNotifJobData>) {
    return await this.handleDelivery(job);
  }
}
