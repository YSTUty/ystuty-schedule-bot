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

import { BROADCAST_QUEUE_NAME } from './broadcast.constants';
import { BroadcastService } from './broadcast.service';
import { BroadcastJobData } from './broadcast.types';
import { BroadcastTransportRegistry } from './transport/broadcast-transport.registry';

@Processor(BROADCAST_QUEUE_NAME)
export class BroadcastProcessor {
  private readonly logger = new Logger(BroadcastProcessor.name);

  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly transportRegistry: BroadcastTransportRegistry,
    @InjectRepository(UserSocial)
    private readonly userSocialRepository: Repository<UserSocial>,
  ) {}

  @Process({ name: 'send', concurrency: 1 })
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
      await this.broadcastService.refreshCampaignCounters(job.data.campaignId);
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
}
