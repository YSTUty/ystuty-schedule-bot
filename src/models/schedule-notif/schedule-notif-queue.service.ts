import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';

import { Queue } from 'bull';

import { SocialType } from '@my-common/constants';

import { ScheduleNotifDelivery } from './entity/schedule-notif-delivery.entity';
import { ScheduleNotif } from './entity/schedule-notif.entity';
import {
  SCHEDULE_NOTIF_MAX_RETRY_ATTEMPTS,
  SCHEDULE_NOTIF_TELEGRAM_QUEUE_NAME,
  SCHEDULE_NOTIF_VK_QUEUE_NAME,
} from './schedule-notif.constants';

export type ScheduleNotifJobData = {
  notifId: number;
  deliveryId: number;
};

type QueueEntry = {
  notif: Pick<ScheduleNotif, 'id' | 'transport'>;
  delivery: Pick<ScheduleNotifDelivery, 'id'>;
};

/** Постановка зарезервированных доставок в устойчивую Redis-очередь. */
@Injectable()
export class ScheduleNotifQueueService {
  constructor(
    @InjectQueue(SCHEDULE_NOTIF_TELEGRAM_QUEUE_NAME)
    private readonly telegramQueue: Queue<ScheduleNotifJobData>,
    @InjectQueue(SCHEDULE_NOTIF_VK_QUEUE_NAME)
    private readonly vkQueue: Queue<ScheduleNotifJobData>,
  ) {}

  public async enqueue(
    notif: QueueEntry['notif'],
    delivery: QueueEntry['delivery'],
  ) {
    await this.enqueueMany([{ notif, delivery }]);
  }

  /** Группирует job по транспорту и добавляет их одним Redis-вызовом на очередь. */
  public async enqueueMany(entries: QueueEntry[]) {
    const telegramEntries = entries.filter(
      (entry) => entry.notif.transport === SocialType.Telegram,
    );
    const vkEntries = entries.filter(
      (entry) => entry.notif.transport === SocialType.Vkontakte,
    );

    await Promise.all([
      this.addBulk(this.telegramQueue, telegramEntries),
      this.addBulk(this.vkQueue, vkEntries),
    ]);
  }

  private async addBulk(
    queue: Queue<ScheduleNotifJobData>,
    entries: QueueEntry[],
  ) {
    if (!entries.length) return;
    await queue.addBulk(
      entries.map(({ notif, delivery }) => ({
        name: 'deliver',
        data: { notifId: notif.id, deliveryId: delivery.id },
        opts: {
          jobId: `schedule-notif-delivery-${delivery.id}`,
          attempts: SCHEDULE_NOTIF_MAX_RETRY_ATTEMPTS,
          backoff: { type: 'schedule_notif_retry' },
          removeOnComplete: true,
          removeOnFail: true,
        },
      })),
    );
  }
}
