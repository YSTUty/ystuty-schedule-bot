import { Injectable } from '@nestjs/common';
import {
  CounterMetric,
  HistogramMetric,
  PromService,
} from '@khaledez/nestjs-prom';
import { linearBuckets } from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly prefix = 'ystuty_';

  public readonly userCounter: CounterMetric;
  public readonly scheduleCounter: CounterMetric;

  public readonly telegramRequestCounter: CounterMetric;
  public readonly telegramRequestDurationHistogram: HistogramMetric;

  public readonly vkRequestCounter: CounterMetric;
  public readonly vkRequestDurationHistogram: HistogramMetric;

  // public readonly anyGauge: GaugeMetric;

  constructor(public readonly promService: PromService) {
    this.userCounter = this.promService.getCounter({
      name: `${this.prefix}user_total`,
      help: 'User counter',
      labelNames: [],
    });
    this.scheduleCounter = this.promService.getCounter({
      name: `${this.prefix}schedule_total`,
      help: 'Schedule request counter',
      labelNames: ['groupName'],
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

    // this.anyGauge = this.promService.getGauge({
    //     name: `${this.prefix}any_gg`,
    //     help: 'Measuring any gg',
    //     labelNames: ['currency'],
    // });
  }
}
