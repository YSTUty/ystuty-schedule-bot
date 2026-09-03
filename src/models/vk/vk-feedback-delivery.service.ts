import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { APIError, getRandomId } from 'vk-io';

import * as xEnv from '@my-environment';

import { isVkRateLimitError, SocialType } from '@my-common';

import { FeedbackAdminDelivery } from '../feedback/entity/feedback-admin-delivery.entity';
import { Feedback } from '../feedback/entity/feedback.entity';
import { FeedbackService } from '../feedback/feedback.service';
import { FeedbackDeliveryStatus } from '../feedback/feedback.types';

import { VkService } from './vk.service';

const CATEGORY_TITLES = {
  schedule: 'Расписание',
  bot: 'Бот',
  suggestion: 'Предложение',
  other: 'Другое',
} as const;

@Injectable()
export class VkFeedbackDeliveryService {
  private readonly logger = new Logger(VkFeedbackDeliveryService.name);
  private isRetryInProgress = false;

  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly vkService: VkService,
  ) {}

  public async deliver(feedback: Feedback) {
    if (!xEnv.SOCIAL_VK_ADMIN_IDS.length) {
      await this.feedbackService.setDeliveryResult(feedback.id, {
        sentCount: 0,
        error: 'No VK feedback administrators configured',
      });
      return false;
    }

    const deliveries = await this.feedbackService.ensureAdminDeliveries(
      feedback,
      xEnv.SOCIAL_VK_ADMIN_IDS,
    );
    for (const delivery of deliveries) {
      await this.deliverOne(delivery);
    }

    return (
      (await this.feedbackService.refreshDeliveryStatus(feedback.id)) ===
      FeedbackDeliveryStatus.Sent
    );
  }

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  protected async retryDueDeliveries() {
    if (this.isRetryInProgress) return;

    this.isRetryInProgress = true;
    try {
      const deliveries = await this.feedbackService.findDueAdminDeliveries(
        SocialType.Vkontakte,
      );
      for (const delivery of deliveries) {
        await this.deliverOne(delivery);
        await this.feedbackService.refreshDeliveryStatus(delivery.feedbackId);
      }
    } catch (error) {
      this.logger.error(
        'VK feedback retry batch failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRetryInProgress = false;
    }
  }

  private async deliverOne(delivery: FeedbackAdminDelivery) {
    const feedback = delivery.feedback;
    if (!feedback) {
      await this.feedbackService.markAdminDeliveryFailed(
        delivery.id,
        'Feedback relation is unavailable',
      );
      return;
    }

    try {
      const adminId = Number(delivery.adminId);
      if (!delivery.headerSentAt) {
        await this.vkService.bot.api.messages.send({
          peer_id: adminId,
          random_id: getRandomId(),
          message: `Обратная связь №${feedback.id}\nКатегория: ${CATEGORY_TITLES[feedback.category]}`,
        });
        await this.feedbackService.markAdminDeliveryHeaderSent(delivery.id);
      }
      await this.vkService.bot.api.messages.send({
        peer_id: adminId,
        random_id: getRandomId(),
        forward_messages: feedback.content.messages.map(
          (message) => message.messageId,
        ),
      });
      await this.feedbackService.markAdminDeliverySent(delivery.id);
    } catch (error) {
      await this.handleDeliveryError(delivery, error);
    }
  }

  private async handleDeliveryError(
    delivery: FeedbackAdminDelivery,
    error: unknown,
  ) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof APIError && isVkRateLimitError(error)) {
      await this.feedbackService.markAdminDeliveryRetry(
        delivery.id,
        1e3,
        message,
      );
      this.logger.warn(
        `Feedback #${delivery.feedbackId} delivery to admin ${delivery.adminId} rate limited; retry in 1000 ms`,
      );
      return;
    }

    await this.feedbackService.markAdminDeliveryFailed(delivery.id, message);
    this.logger.error(
      `Feedback #${delivery.feedbackId} delivery to admin ${delivery.adminId} failed`,
      error instanceof Error ? error.stack : message,
    );
  }
}
