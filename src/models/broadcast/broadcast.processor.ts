import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Repository } from 'typeorm';

import { Job } from 'bull';

import { UserSocial } from '../user/entity/user-social.entity';

import {
  BROADCAST_TELEGRAM_QUEUE_NAME,
  BROADCAST_VK_QUEUE_NAME,
} from './broadcast.constants';
import { BroadcastService } from './broadcast.service';
import { BroadcastJobData } from './broadcast.types';
import { BroadcastTransportRegistry } from './transport/broadcast-transport.registry';

export class BroadcastProcessorBase {
  private readonly logger = new Logger(BroadcastProcessorBase.name);

  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly transportRegistry: BroadcastTransportRegistry,
    @InjectRepository(UserSocial)
    private readonly userSocialRepository: Repository<UserSocial>,
  ) {}

  async handleSend(job: Job<BroadcastJobData>) {
    const campaign = await this.broadcastService.getCampaign(
      job.data.campaignId,
    );
    if (!campaign) {
      throw new Error(`Broadcast campaign not found: ${job.data.campaignId}`);
    }

    await this.broadcastService.markCampaignRunning(campaign.id);

    try {
      const transport = this.transportRegistry.get(job.data.social);
      const result = await transport.sendCampaignDelivery({
        targetSocialId: job.data.targetSocialId,
        mode: campaign.mode,
        sourceMessage: campaign.sourceMessage,
      });

      await this.broadcastService.markDeliverySent(
        job.data.deliveryId,
        result.messageId,
      );
      return result.messageId;
    } catch (err) {
      const message = this.getErrorMessage(err);
      await this.broadcastService.markDeliveryFailed(
        job.data.deliveryId,
        message,
      );

      if (this.isBlockedRecipientError(message)) {
        await this.userSocialRepository.update(
          {
            social: job.data.social,
            socialId: Number(job.data.targetSocialId),
          },
          { isBlockedBot: true },
        );
      }

      throw err;
    } finally {
      const counters = await this.broadcastService.refreshCampaignCounters(
        job.data.campaignId,
      );
      const updatedCampaign = await this.broadcastService.getCampaign(
        job.data.campaignId,
      );
      if (updatedCampaign) {
        await this.updateProgressMessage(updatedCampaign, counters);
      }
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job<BroadcastJobData>, result: string | null) {
    this.logger.debug(
      `Completed broadcast job ${job.id} for campaign #${job.data.campaignId}: ${result}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<BroadcastJobData>, err: Error) {
    this.logger.error(
      `Failed broadcast job ${job.id} for campaign #${job.data.campaignId}: ${err.message}`,
      err.stack,
    );
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'description' in err) {
      return String((err as { description: unknown }).description);
    }

    return String(err);
  }

  private isBlockedRecipientError(message: string): boolean {
    return [
      'bot was blocked',
      'bot was kicked',
      'user is deactivated',
      'chat not found',
      'peer_id',
    ].some((part) => message.toLowerCase().includes(part));
  }

  private async updateProgressMessage(
    campaign: Awaited<ReturnType<BroadcastService['getCampaign']>>,
    counters: Awaited<ReturnType<BroadcastService['refreshCampaignCounters']>>,
  ) {
    if (!campaign?.sourceMessage.reportMessage) return;

    const doneCount =
      counters.sentCount + counters.failedCount + counters.skippedCount;
    const finished = doneCount >= counters.totalCount;
    if (
      !this.broadcastService.shouldUpdateProgress({
        sourceMessage: campaign.sourceMessage,
        doneCount,
        totalCount: counters.totalCount,
        finished,
      })
    ) {
      return;
    }

    const transport = this.transportRegistry.get(campaign.social);
    if (!transport.updateCampaignProgress) return;
    const queueStatus = await this.broadcastService.getQueueStatus(
      campaign.social,
    );

    const text = [
      `<b>Рассылка #${campaign.id}</b>`,
      `Готово: <code>${doneCount}/${counters.totalCount}</code>`,
      `Успешно: <code>${counters.sentCount}</code>`,
      `Ошибки: <code>${counters.failedCount}</code>`,
      `Пропущено: <code>${counters.skippedCount}</code>`,
      `Статус: <code>${counters.status}</code>`,
    ].join('\n');

    const updated = await transport.updateCampaignProgress({
      reportMessage: campaign.sourceMessage.reportMessage,
      status: counters.status,
      paused: queueStatus.paused,
      text,
    });
    if (updated) {
      await this.broadcastService.markProgressUpdated(campaign, doneCount);
    }
  }
}

@Processor(BROADCAST_TELEGRAM_QUEUE_NAME)
export class TelegramBroadcastProcessor extends BroadcastProcessorBase {
  @Process({ name: 'send', concurrency: 1 })
  async handleTelegramSend(job: Job<BroadcastJobData>) {
    return await this.handleSend(job);
  }
}

@Processor(BROADCAST_VK_QUEUE_NAME)
export class VkBroadcastProcessor extends BroadcastProcessorBase {
  @Process({ name: 'send', concurrency: 1 })
  async handleVkSend(job: Job<BroadcastJobData>) {
    return await this.handleSend(job);
  }
}
