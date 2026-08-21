import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { TelegramError } from 'telegraf';
import { APIError } from 'vk-io';

import {
  delay,
  isTelegramConversationUnavailableError,
  isTelegramRateLimitError,
  isVkConversationUnavailableError,
  isVkRateLimitError,
  SocialType,
} from '@my-common';

import { TelegramService } from '../telegram/telegram.service';
import { VkService } from '../vk/vk.service';

import { Conversation } from './entity/conversation.entity';
import { SocialService } from './social.service';

@Injectable()
export class ConversationMembershipScheduler {
  private readonly logger = new Logger(ConversationMembershipScheduler.name);
  protected wait = delay;

  constructor(
    private readonly socialService: SocialService,
    private readonly telegramService: TelegramService,
    private readonly vkService: VkService,
  ) {}

  @Cron('0 15 4,16 * * *', {
    name: 'conversation-membership-reconciliation',
    timeZone: 'Europe/Moscow',
    waitForCompletion: true,
  })
  protected async onCron() {
    try {
      await this.run();
    } catch (error) {
      this.logger.error(
        'Conversation membership reconciliation failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Последовательно сверяет активные беседы, не меняя их при временной API-ошибке. */
  public async run() {
    const conversations = await this.socialService.findActiveConversations();
    for (const conversation of conversations) {
      await this.reconcileConversation(conversation);
    }
  }

  private async reconcileConversation(conversation: Conversation) {
    const membership = await this.readMembershipWithRateLimitWait(conversation);
    if (!membership) {
      return;
    }

    const changed = await this.socialService.syncConversationMembership(
      conversation,
      membership,
    );
    if (changed) {
      this.logger.log(
        `[${conversation.social}][conversation] reconciled id=${String(conversation.conversationId)} isLeaved=${membership.isLeaved} status=${membership.chatStatus}`,
      );
    }
  }

  private async readMembershipWithRateLimitWait(conversation: Conversation) {
    while (true) {
      try {
        return await this.readMembership(conversation);
      } catch (error) {
        const retryAfterMs = this.getRateLimitWaitMs(error);
        if (retryAfterMs !== null) {
          this.logger.warn(
            `[${conversation.social}][conversation] rate limited; waiting ${retryAfterMs} ms before retrying id=${String(conversation.conversationId)}`,
          );
          await this.wait(retryAfterMs);
          continue;
        }

        if (this.isConversationUnavailableError(conversation.social, error)) {
          return { isLeaved: true, chatStatus: 'kicked' };
        }

        this.logger.error(
          `[${conversation.social}][conversation] failed to reconcile id=${String(conversation.conversationId)}`,
          error instanceof Error ? error.stack : String(error),
        );
        return null;
      }
    }
  }

  private async readMembership(conversation: Conversation) {
    const convId = Number(conversation.conversationId);

    switch (conversation.social) {
      case SocialType.Telegram:
        return await this.telegramService.getBotChatMembership(convId);
      case SocialType.Vkontakte:
        return await this.vkService.getBotConversationMembership(convId);
      default:
        return null;
    }
  }

  private getRateLimitWaitMs(error: unknown) {
    if (error instanceof TelegramError && isTelegramRateLimitError(error)) {
      return Math.max(1, error.parameters?.retry_after ?? 1) * 1e3;
    }
    if (error instanceof APIError && isVkRateLimitError(error)) {
      return 1e3;
    }
    return null;
  }

  private isConversationUnavailableError(social: SocialType, error: unknown) {
    return (
      (social === SocialType.Telegram &&
        error instanceof TelegramError &&
        isTelegramConversationUnavailableError(error)) ||
      (social === SocialType.Vkontakte &&
        error instanceof APIError &&
        isVkConversationUnavailableError(error))
    );
  }
}
