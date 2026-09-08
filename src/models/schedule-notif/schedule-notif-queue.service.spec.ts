import { SocialType } from '@my-common/constants';

import { ScheduleNotifQueueService } from './schedule-notif-queue.service';
import { SCHEDULE_NOTIF_MAX_RETRY_ATTEMPTS } from './schedule-notif.constants';

describe('ScheduleNotifQueueService', () => {
  it('groups deliveries by transport and uses durable retry jobs', async () => {
    const telegramQueue = { addBulk: jest.fn() };
    const vkQueue = { addBulk: jest.fn() };
    const service = new ScheduleNotifQueueService(
      telegramQueue as any,
      vkQueue as any,
    );

    await service.enqueueMany([
      {
        notif: { id: 1, transport: SocialType.Telegram },
        delivery: { id: 11 },
      },
      {
        notif: { id: 2, transport: SocialType.Vkontakte },
        delivery: { id: 12 },
      },
    ]);

    expect(telegramQueue.addBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'deliver',
        data: { notifId: 1, deliveryId: 11 },
        opts: expect.objectContaining({
          jobId: 'schedule-notif-delivery-11',
          attempts: SCHEDULE_NOTIF_MAX_RETRY_ATTEMPTS,
          backoff: { type: 'schedule_notif_retry' },
        }),
      }),
    ]);
    expect(vkQueue.addBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        data: { notifId: 2, deliveryId: 12 },
        opts: expect.objectContaining({
          jobId: 'schedule-notif-delivery-12',
        }),
      }),
    ]);
  });
});
