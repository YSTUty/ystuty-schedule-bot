import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { SocialType } from '@my-common/constants';

import { RedisService } from '../redis/redis.service';

import { FeedbackAdminDelivery } from './entity/feedback-admin-delivery.entity';
import { Feedback } from './entity/feedback.entity';
import {
  CreateFeedbackParams,
  FeedbackAdminDeliveryStatus,
  FeedbackDeliveryStatus,
} from './feedback.types';

export const FEEDBACK_COOLDOWN_SECONDS = 5 * 60;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
    @InjectRepository(FeedbackAdminDelivery)
    private readonly adminDeliveryRepository: Repository<FeedbackAdminDelivery>,
    private readonly redisService: RedisService,
  ) {}

  /** Создаёт отзыв, резервируя пяти минутный cooldown атомарной Redis-командой. */
  async create(params: CreateFeedbackParams): Promise<Feedback | null> {
    const cooldownKey = this.getCooldownKey(params.social, params.userSocialId);
    const reserved = await this.redisService.redis.set(
      cooldownKey,
      '1',
      'EX',
      FEEDBACK_COOLDOWN_SECONDS,
      'NX',
    );
    if (reserved !== 'OK') return null;

    try {
      return await this.feedbackRepository.save(
        this.feedbackRepository.create({
          ...params,
          userSocialId: params.userSocialId,
        }),
      );
    } catch (error) {
      await this.redisService.redis.del(cooldownKey);
      throw error;
    }
  }

  async setDeliveryResult(
    feedbackId: number,
    result: { sentCount: number; error?: string },
  ) {
    const deliveryStatus = !result.sentCount
      ? FeedbackDeliveryStatus.Failed
      : result.error
        ? FeedbackDeliveryStatus.Partial
        : FeedbackDeliveryStatus.Sent;
    await this.feedbackRepository.update(feedbackId, {
      deliveryStatus,
      deliveredAt: result.sentCount ? new Date() : null,
      deliveryError: result.error || null,
    });
    return deliveryStatus;
  }

  /** Создаёт отсутствующие recipient delivery, не дублируя уже зарегистрированные. */
  async ensureAdminDeliveries(feedback: Feedback, adminIds: readonly number[]) {
    const existing = await this.adminDeliveryRepository.find({
      where: { feedbackId: feedback.id, social: feedback.social },
    });
    const existingAdminIds = new Set(
      existing.map((delivery) => delivery.adminId),
    );
    const missingAdminIds = adminIds.filter(
      (adminId) => !existingAdminIds.has(String(adminId)),
    );

    if (missingAdminIds.length) {
      await this.adminDeliveryRepository.save(
        missingAdminIds.map((adminId) =>
          this.adminDeliveryRepository.create({
            feedbackId: feedback.id,
            social: feedback.social,
            adminId: String(adminId),
            status: FeedbackAdminDeliveryStatus.Pending,
            headerSentAt: null,
            deliveredAt: null,
            attempts: 0,
            retryAt: null,
            lastError: null,
          }),
        ),
      );
    }

    return await this.adminDeliveryRepository.find({
      where: { feedbackId: feedback.id, social: feedback.social },
      relations: ['feedback'],
      order: { id: 'ASC' },
    });
  }

  async findDueAdminDeliveries(social: SocialType, now = new Date()) {
    return await this.adminDeliveryRepository.find({
      where: {
        social,
        status: FeedbackAdminDeliveryStatus.Retrying,
        retryAt: LessThanOrEqual(now),
      },
      relations: ['feedback'],
      order: { retryAt: 'ASC', id: 'ASC' },
    });
  }

  async markAdminDeliveryHeaderSent(deliveryId: number) {
    await this.adminDeliveryRepository.update(deliveryId, {
      headerSentAt: new Date(),
      attempts: () => '"attempts" + 1',
      retryAt: null,
      lastError: null,
    });
  }

  async markAdminDeliverySent(deliveryId: number) {
    await this.adminDeliveryRepository.update(deliveryId, {
      status: FeedbackAdminDeliveryStatus.Sent,
      deliveredAt: new Date(),
      retryAt: null,
      lastError: null,
    });
  }

  async markAdminDeliveryRetry(
    deliveryId: number,
    retryAfterMs: number,
    error: string,
  ) {
    const retryAt = new Date(Date.now() + retryAfterMs);
    await this.adminDeliveryRepository.update(deliveryId, {
      status: FeedbackAdminDeliveryStatus.Retrying,
      attempts: () => '"attempts" + 1',
      retryAt,
      lastError: error.slice(0, 2000),
    });
  }

  async markAdminDeliveryFailed(deliveryId: number, error: string) {
    await this.adminDeliveryRepository.update(deliveryId, {
      status: FeedbackAdminDeliveryStatus.Failed,
      attempts: () => '"attempts" + 1',
      retryAt: null,
      lastError: error.slice(0, 2000),
    });
  }

  /** Пересчитывает итог feedback из delivery отдельных администраторов. */
  async refreshDeliveryStatus(feedbackId: number) {
    const deliveries = await this.adminDeliveryRepository.find({
      where: { feedbackId },
    });
    const sentCount = deliveries.filter(
      (delivery) => delivery.status === FeedbackAdminDeliveryStatus.Sent,
    ).length;
    const hasPending = deliveries.some((delivery) =>
      [
        FeedbackAdminDeliveryStatus.Pending,
        FeedbackAdminDeliveryStatus.Retrying,
      ].includes(delivery.status),
    );
    const errors = deliveries
      .filter((delivery) => delivery.lastError)
      .map(
        (delivery) =>
          `admin=${delivery.adminId}: ${delivery.lastError as string}`,
      );
    const deliveryStatus = hasPending
      ? sentCount
        ? FeedbackDeliveryStatus.Partial
        : FeedbackDeliveryStatus.Pending
      : !sentCount
        ? FeedbackDeliveryStatus.Failed
        : errors.length
          ? FeedbackDeliveryStatus.Partial
          : FeedbackDeliveryStatus.Sent;

    await this.feedbackRepository.update(feedbackId, {
      deliveryStatus,
      deliveredAt: sentCount ? new Date() : null,
      deliveryError: errors.join('; ').slice(0, 2000) || null,
    });
    return deliveryStatus;
  }

  private getCooldownKey(social: string, userSocialId: number) {
    return `feedback:cooldown:${social}:${userSocialId}`;
  }
}
