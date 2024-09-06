import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  public readonly prefix = 'ystuty_';
  public readonly gateway: Pushgateway<PrometheusContentType>;

  public readonly userCounter: Gauge;
  public readonly userSocialCounter: Gauge;
  public readonly scheduleCounter: Gauge;

  public readonly telegramRequestCounter: CounterMetric;
  public readonly telegramRequestDurationHistogram: HistogramMetric;

  public readonly vkRequestCounter: CounterMetric;
  public readonly vkRequestDurationHistogram: HistogramMetric;

  constructor(public readonly promService: PromService) {
    this.gateway = xEnv.PROMETHEUS_PUSHGATEWAY_URL
      ? new Pushgateway(xEnv.PROMETHEUS_PUSHGATEWAY_URL)
      : null;

    this.userCounter = this.promService.getGauge({
      name: `${this.prefix}user_count`,
      help: 'User counter',
      labelNames: [],
    });
    this.userSocialCounter = this.promService.getGauge({
      name: `${this.prefix}user_social_count`,
      help: 'User socials counter',
      labelNames: ['social'],
    });
    this.scheduleCounter = this.promService.getGauge({
      name: `${this.prefix}schedule_count`,
      help: 'Schedule request counter',
      labelNames: ['groupName', 'teacherId'],
    });

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

  @Cron(CronExpression.EVERY_5_MINUTES)
  protected pushMetricsToGateway() {
    if (!this.gateway || !xEnv.PROMETHEUS_ENABLED) {
      return;
    }

    const jobName = 'schedule_bot_metrics';
    this.gateway
      .pushAdd({ jobName, groupings: { app: xEnv.INSTANCE_NAME } })
      .then((response) => {
        // console.log('Metrics pushed to the Pushgateway', response.body);
      })
      .catch((err) => this.logger.error('[pushMetricsToGateway] Error', err));
  }
}
