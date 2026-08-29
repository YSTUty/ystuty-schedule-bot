import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RedisService } from '../redis/redis.service';

import { Feedback } from './entity/feedback.entity';
import { CreateFeedbackParams, FeedbackDeliveryStatus } from './feedback.types';

export const FEEDBACK_COOLDOWN_SECONDS = 5 * 60;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
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

  private getCooldownKey(social: string, userSocialId: number) {
    return `feedback:cooldown:${social}:${userSocialId}`;
  }
}
