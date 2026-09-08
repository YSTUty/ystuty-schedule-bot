import { TelegramError } from 'telegraf-hardened';

import { SocialType } from '@my-common/constants';

import { ScheduleNotifRateLimitError } from './schedule-notif-rate-limit.exception';
import { SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS } from './schedule-notif.constants';
import { TelegramScheduleNotifProcessor } from './schedule-notif.processor';

describe('TelegramScheduleNotifProcessor', () => {
  const notif = { id: 1, transport: SocialType.Telegram } as any;
  const delivery = {
    id: 2,
    notifId: 1,
    scheduledFor: new Date(),
  } as any;

  const createJob = () =>
    ({
      data: { notifId: 1, deliveryId: 2 },
      opts: { attempts: 4 },
      attemptsMade: 0,
      discard: jest.fn(),
    }) as any;

  const createService = () => {
    const deliveryService = {
      getPendingDeliveryForProcessing: jest
        .fn()
        .mockResolvedValue({ notif, delivery }),
      deliver: jest.fn(),
      markRetry: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    };
    return {
      deliveryService,
      processor: new TelegramScheduleNotifProcessor(deliveryService as any),
    };
  };

  beforeEach(() => {
    delivery.scheduledFor = new Date();
  });

  it('retries transient delivery errors without marking the delivery failed', async () => {
    const { processor, deliveryService } = createService();
    const error = Object.assign(new Error('request timed out'), {
      code: 'ETIMEDOUT',
    });
    deliveryService.deliver.mockRejectedValue(error);

    await expect(processor.handleTelegramDelivery(createJob())).rejects.toBe(
      error,
    );

    expect(deliveryService.markRetry).toHaveBeenCalledWith(
      delivery,
      'request timed out',
    );
    expect(deliveryService.markFailed).not.toHaveBeenCalled();
  });

  it('uses Telegram retry_after as the exact queue backoff', async () => {
    const { processor, deliveryService } = createService();
    deliveryService.deliver.mockRejectedValue(
      new TelegramError({
        error_code: 429,
        description: 'Too Many Requests: retry after 7',
        parameters: { retry_after: 7 },
      }),
    );

    await expect(processor.handleTelegramDelivery(createJob())).rejects.toEqual(
      expect.objectContaining({
        name: ScheduleNotifRateLimitError.name,
        retryAfterMs: 10e3,
      }),
    );
    expect(deliveryService.markRetry).toHaveBeenCalled();
  });

  it('records permanent Telegram errors without retrying', async () => {
    const { processor, deliveryService } = createService();
    const job = createJob();
    deliveryService.deliver.mockRejectedValue(
      new TelegramError({
        error_code: 403,
        description: 'Forbidden: bot was blocked by the user',
      }),
    );

    await expect(processor.handleTelegramDelivery(job)).resolves.toBeNull();

    expect(job.discard).toHaveBeenCalled();
    expect(deliveryService.markFailed).toHaveBeenCalledWith(
      notif,
      delivery,
      '403: Forbidden: bot was blocked by the user',
    );
  });

  it('marks a transient error as failed after its retry budget is exhausted', async () => {
    const { processor, deliveryService } = createService();
    const job = createJob();
    job.attemptsMade = 3;
    deliveryService.deliver.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(processor.handleTelegramDelivery(job)).resolves.toBeNull();

    expect(job.discard).toHaveBeenCalled();
    expect(deliveryService.markRetry).not.toHaveBeenCalled();
    expect(deliveryService.markFailed).toHaveBeenCalledWith(
      notif,
      delivery,
      'ETIMEDOUT',
    );
  });

  it('skips expired deliveries before calling the transport', async () => {
    const { processor, deliveryService } = createService();
    delivery.scheduledFor = new Date(
      Date.now() - SCHEDULE_NOTIF_MAX_DELIVERY_DELAY_MS - 1,
    );

    await expect(
      processor.handleTelegramDelivery(createJob()),
    ).resolves.toBeNull();

    expect(deliveryService.deliver).not.toHaveBeenCalled();
    expect(deliveryService.markSkipped).toHaveBeenCalledWith(
      notif,
      delivery,
      'Notification delivery expired before it was sent',
    );
  });
});
