import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import {
  CounterMetric,
  HistogramMetric,
  PromService,
} from '@khaledez/nestjs-prom';
import {
  Gauge,
  linearBuckets,
  PrometheusContentType,
  Pushgateway,
} from 'prom-client';

import * as xEnv from '@my-environment';

import { SocialType } from '@my-common/constants';

import { Conversation } from '../social/entity/conversation.entity';
import { UserSocial } from '../user/entity/user-social.entity';
import { User } from '../user/entity/user.entity';

const USER_STATUSES = ['active', 'banned'] as const;
const BOOLEAN_LABEL_VALUES = ['false', 'true'] as const;
const UNKNOWN_CHAT_STATUS = 'unknown';
const OTHER_CHAT_STATUS = 'other';
const KNOWN_CHAT_STATUSES = new Set([
  'administrator',
  'creator',
  'kicked',
  'left',
  'member',
  'owner',
  'restricted',
]);

@Injectable()
export class MetricsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MetricsService.name);
  private isPushInProgress = false;

  public readonly prefix = 'ystuty_';
  public readonly gateway: Pushgateway<PrometheusContentType> | null;

  public readonly userCounter: Gauge;
  public readonly userStatusCounter: Gauge;
  public readonly userSocialCounter: Gauge;
  public readonly userSocialStatusCounter: Gauge;
  public readonly conversationCounter: Gauge;
  public readonly conversationStatusCounter: Gauge;
  public readonly scheduleRequestCounter: CounterMetric;
  public readonly scheduleTargetRequestCounter: CounterMetric | null;

  public readonly telegramRequestCounter: CounterMetric;
  public readonly telegramRequestDurationHistogram: HistogramMetric;

  public readonly vkRequestCounter: CounterMetric;
  public readonly vkRequestDurationHistogram: HistogramMetric;

  constructor(
    public readonly promService: PromService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.gateway = xEnv.PROMETHEUS_PUSHGATEWAY_URL
      ? new Pushgateway(xEnv.PROMETHEUS_PUSHGATEWAY_URL)
      : null;

    this.userCounter = this.promService.getGauge({
      name: `${this.prefix}user_count`,
      help: 'Active user count',
      labelNames: [],
    });
    this.userStatusCounter = this.promService.getGauge({
      name: `${this.prefix}user_status_count`,
      help: 'User count by ban status',
      labelNames: ['status'],
    });
    this.userSocialCounter = this.promService.getGauge({
      name: `${this.prefix}user_social_count`,
      help: 'Social profile count with available direct messages',
      labelNames: ['social'],
    });
    this.userSocialStatusCounter = this.promService.getGauge({
      name: `${this.prefix}user_social_status_count`,
      help: 'Social profile count by availability, block, and authorization state',
      labelNames: ['social', 'is_blocked', 'has_dm', 'is_authorized'],
    });
    this.conversationCounter = this.promService.getGauge({
      name: `${this.prefix}conversation_count`,
      help: 'Social conversations counter',
      labelNames: ['social'],
    });
    this.conversationStatusCounter = this.promService.getGauge({
      name: `${this.prefix}conversation_status_count`,
      help: 'Conversation count by membership and chat status',
      labelNames: ['social', 'is_leaved', 'chat_status'],
    });
    this.scheduleRequestCounter = this.promService.getCounter({
      name: `${this.prefix}schedule_request_total`,
      help: 'Schedule requests by target type',
      labelNames: ['target_type'],
    });
    this.scheduleTargetRequestCounter =
      xEnv.PROMETHEUS_DETAILED_SCHEDULE_TARGET_METRICS
        ? this.promService.getCounter({
            name: `${this.prefix}schedule_target_request_total`,
            help: 'Schedule requests by concrete group or teacher',
            labelNames: ['target_type', 'target'],
          })
        : null;

    this.telegramRequestCounter = this.promService.getCounter({
      name: `${this.prefix}telegram_request_total`,
      labelNames: ['updateType', 'status'],
      help: 'Telegram requests - counter',
    });
    this.telegramRequestDurationHistogram = this.promService.getHistogram({
      name: `${this.prefix}telegram_request_duration`,
      help: 'Telegram requests - Duration in seconds',
      labelNames: ['updateType', 'status'],
      buckets: linearBuckets(0, 0.05, 10),
    });

    this.vkRequestCounter = this.promService.getCounter({
      name: `${this.prefix}vk_request_total`,
      labelNames: ['updateType', 'status'],
      help: 'VK requests - counter',
    });
    this.vkRequestDurationHistogram = this.promService.getHistogram({
      name: `${this.prefix}vk_request_duration`,
      help: 'VK requests - Duration in seconds',
      labelNames: ['updateType', 'status'],
      buckets: linearBuckets(0, 0.05, 10),
    });
  }

  async onApplicationBootstrap() {
    await this.refreshDomainGauges();
    void this.pushMetricsToGateway();
  }

  /** Восстанавливает gauge из БД, чтобы restart не влиял на текущие значения. */
  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  protected async refreshDomainGaugesAndPush() {
    await this.refreshDomainGauges();
    void this.pushMetricsToGateway();
  }

  public async refreshDomainGauges() {
    try {
      const [users, userSocials, conversations] = await Promise.all([
        this.dataSource.getRepository(User).find({
          select: { isBanned: true },
        }),
        this.dataSource.getRepository(UserSocial).find({
          select: {
            social: true,
            isBlockedBot: true,
            hasDM: true,
            userId: true,
          },
        }),
        this.dataSource.getRepository(Conversation).find({
          select: { social: true, isLeaved: true, chatStatus: true },
        }),
      ]);

      this.setUserGauges(users);
      this.setUserSocialGauges(userSocials);
      this.setConversationGauges(conversations);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error('[refreshDomainGauges] Error', stack);
    }
  }

  private setUserGauges(users: Pick<User, 'isBanned'>[]) {
    const statusCounts = new Map<string, number>(
      USER_STATUSES.map((status) => [status, 0]),
    );

    for (const user of users) {
      const status = user.isBanned ? 'banned' : 'active';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    }

    this.userCounter.reset();
    this.userStatusCounter.reset();
    this.userCounter.set(statusCounts.get('active') || 0);
    for (const status of USER_STATUSES) {
      this.userStatusCounter.set({ status }, statusCounts.get(status) || 0);
    }
  }

  private setUserSocialGauges(
    userSocials: Pick<
      UserSocial,
      'social' | 'isBlockedBot' | 'hasDM' | 'userId'
    >[],
  ) {
    const totalBySocial = new Map<SocialType, number>(
      Object.values(SocialType).map((social) => [social, 0]),
    );
    const statusCounts = new Map<string, number>();

    for (const userSocial of userSocials) {
      const isBlocked = String(!!userSocial.isBlockedBot);
      const hasDM = String(!!userSocial.hasDM);
      const isAuthorized = String(userSocial.userId != null);
      const key = `${userSocial.social}:${isBlocked}:${hasDM}:${isAuthorized}`;
      statusCounts.set(key, (statusCounts.get(key) || 0) + 1);

      if (userSocial.hasDM && !userSocial.isBlockedBot) {
        totalBySocial.set(
          userSocial.social,
          (totalBySocial.get(userSocial.social) || 0) + 1,
        );
      }
    }

    this.userSocialCounter.reset();
    this.userSocialStatusCounter.reset();
    for (const social of Object.values(SocialType)) {
      this.userSocialCounter.set({ social }, totalBySocial.get(social) || 0);
      for (const isBlocked of BOOLEAN_LABEL_VALUES) {
        for (const hasDM of BOOLEAN_LABEL_VALUES) {
          for (const isAuthorized of BOOLEAN_LABEL_VALUES) {
            const key = `${social}:${isBlocked}:${hasDM}:${isAuthorized}`;
            this.userSocialStatusCounter.set(
              {
                social,
                is_blocked: isBlocked,
                has_dm: hasDM,
                is_authorized: isAuthorized,
              },
              statusCounts.get(key) || 0,
            );
          }
        }
      }
    }
  }

  private setConversationGauges(
    conversations: Pick<Conversation, 'social' | 'isLeaved' | 'chatStatus'>[],
  ) {
    const totalBySocial = new Map<SocialType, number>(
      Object.values(SocialType).map((social) => [social, 0]),
    );
    const statusCounts = new Map<string, number>();

    for (const conversation of conversations) {
      const isLeaved = String(!!conversation.isLeaved);
      const chatStatus = this.normalizeChatStatus(conversation.chatStatus);
      const key = `${conversation.social}:${isLeaved}:${chatStatus}`;
      statusCounts.set(key, (statusCounts.get(key) || 0) + 1);
      totalBySocial.set(
        conversation.social,
        (totalBySocial.get(conversation.social) || 0) + 1,
      );
    }

    this.conversationCounter.reset();
    this.conversationStatusCounter.reset();
    for (const social of Object.values(SocialType)) {
      this.conversationCounter.set({ social }, totalBySocial.get(social) || 0);
    }
    for (const [key, count] of statusCounts) {
      const [social, isLeaved, chatStatus] = key.split(':');
      this.conversationStatusCounter.set(
        { social, is_leaved: isLeaved, chat_status: chatStatus },
        count,
      );
    }
  }

  private normalizeChatStatus(chatStatus: string | null) {
    if (!chatStatus) {
      return UNKNOWN_CHAT_STATUS;
    }

    const normalizedStatus = chatStatus.toLocaleLowerCase('en');
    return KNOWN_CHAT_STATUSES.has(normalizedStatus)
      ? normalizedStatus
      : OTHER_CHAT_STATUS;
  }

  /** Учитывает общий запрос и, при явном включении, его конкретную цель. */
  public incrementScheduleRequest(
    targetType: 'group' | 'teacher',
    target: string | number,
  ) {
    this.scheduleRequestCounter.inc({ target_type: targetType });
    this.scheduleTargetRequestCounter?.inc({
      target_type: targetType,
      target: String(target),
    });
  }

  protected async pushMetricsToGateway() {
    if (!this.gateway || !xEnv.PROMETHEUS_ENABLED) {
      return;
    }
    if (this.isPushInProgress) {
      return;
    }

    const jobName = 'schedule_bot_metrics';
    this.isPushInProgress = true;
    try {
      await this.gateway.pushAdd({
        jobName,
        groupings: { app: xEnv.INSTANCE_NAME },
      });
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error('[pushMetricsToGateway] Error', stack);
    } finally {
      this.isPushInProgress = false;
    }
  }
}
