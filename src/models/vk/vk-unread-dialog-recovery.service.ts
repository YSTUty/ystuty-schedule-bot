import { Injectable, Logger } from '@nestjs/common';
import { InjectVkApi } from 'nestjs-vk';

import { APIError, getRandomId, VK } from 'vk-io';

import * as xEnv from '@my-environment';

import {
  delay,
  isVkRateLimitError,
  isVkUserUnavailableError,
} from '@my-common';
import { i18n } from '@my-common/util/vk';
import { LocalePhrase } from '@my-interfaces';

import { RedisService } from '../redis/redis.service';

const UNREAD_DIALOGS_PAGE_SIZE = 200;
const UNREAD_MESSAGE_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1e3;
const UNREAD_MESSAGE_DEDUP_TTL_SECONDS = 5 * 24 * 60 * 60;
const UNREAD_RECOVERY_REQUEST_INTERVAL_MS = 1e3;
const UNREAD_RECOVERY_CLIENT_INFO = {
  button_actions: [],
  carousel: false,
  inline_keyboard: true,
  keyboard: true,
  lang_id: 0,
};

type VkUnreadMessage = {
  date?: number;
  from_id?: number;
  id?: number;
  out?: boolean | number;
  payload?: string;
  peer_id?: number;
  text?: string;
  [key: string]: unknown;
};

type VkUnreadDialog = {
  conversation?: { peer?: { id?: number } };
  last_message?: VkUnreadMessage;
};

type UnreadMessageRecoveryCandidate = {
  peerId: number;
  message: VkUnreadMessage;
};

/** Восстанавливает только непрочитанные ЛС, которые VK не отдал после простоя polling. */
@Injectable()
export class VkUnreadDialogRecoveryService {
  private readonly logger = new Logger(VkUnreadDialogRecoveryService.name);
  protected wait = delay;

  constructor(
    @InjectVkApi() private readonly bot: VK,
    private readonly redisService: RedisService,
  ) {}

  /** Однократно после старта пытается ответить на свежие непрочитанные ЛС. */
  public async recoverUnreadDirectMessages(now = new Date()) {
    const groupId = xEnv.SOCIAL_VK_GROUP_ID;
    if (!groupId) return;

    const dialogs = await this.readUnreadDialogs(groupId);
    let recoveredCount = 0;

    for (const dialog of dialogs) {
      const candidate = this.getCandidate(dialog, now);
      if (!candidate) continue;

      const claimKey = await this.claimMessage(
        candidate.peerId,
        candidate.message.id!,
      );
      if (!claimKey) continue;

      try {
        await this.notifyAboutRecovery(candidate.peerId);
        await this.replayMessage(groupId, candidate);
        recoveredCount += 1;
        this.logger.log(
          `[VK][unread-recovery] processed peer=${candidate.peerId} message=${candidate.message.id}`,
        );
      } catch (error) {
        if (error instanceof APIError && isVkUserUnavailableError(error)) {
          // Сообщение уже подтверждает факт ЛС. Пропускаем его через обычный
          // маршрут, чтобы создать профиль и сохранить недоступность бота.
          await this.replayUnavailableUserMessage(groupId, candidate);
          continue;
        }

        await this.releaseClaim(claimKey);
        this.logger.warn(
          `[VK][unread-recovery] failed peer=${candidate.peerId} message=${candidate.message.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        // Не создаём burst API-вызовов, когда после простоя накопилось много ЛС.
        await this.wait(UNREAD_RECOVERY_REQUEST_INTERVAL_MS);
      }
    }

    if (recoveredCount > 0) {
      this.logger.log(
        `[VK][unread-recovery] completed processed=${recoveredCount}`,
      );
    }
  }

  private async readUnreadDialogs(groupId: number): Promise<VkUnreadDialog[]> {
    const dialogs: VkUnreadDialog[] = [];
    let offset = 0;

    while (true) {
      const { count, items } = await this.withRateLimitWait(
        'messages.getConversations',
        async () =>
          await this.bot.api.messages.getConversations({
            count: UNREAD_DIALOGS_PAGE_SIZE,
            filter: 'unread', // unanswered
            group_id: groupId,
            offset,
          }),
      );
      const page = items as VkUnreadDialog[];
      dialogs.push(...page);
      offset += page.length;

      if (page.length === 0 || offset >= count) {
        return dialogs;
      }
    }
  }

  private getCandidate(
    dialog: VkUnreadDialog,
    now: Date,
  ): UnreadMessageRecoveryCandidate | null {
    const message = dialog.last_message;
    const peerId = dialog.conversation?.peer?.id ?? message?.peer_id;
    if (
      !message ||
      typeof peerId !== 'number' ||
      !Number.isSafeInteger(peerId) ||
      !Number.isSafeInteger(message.id) ||
      peerId < 1 ||
      peerId > 2e9 ||
      message.from_id !== peerId ||
      Boolean(message.out) ||
      Boolean(message.payload) ||
      !message.text?.trim()
    ) {
      return null;
    }

    const ageMs = now.getTime() - (message.date ?? 0) * 1e3;
    if (ageMs < 0 || ageMs > UNREAD_MESSAGE_MAX_AGE_MS) {
      return null;
    }

    return { peerId, message };
  }

  private async claimMessage(peerId: number, messageId: number) {
    const key = `vk:unread-recovery:${peerId}:${messageId}`;
    const result = await this.redisService.redis.set(
      key,
      '1',
      'EX',
      UNREAD_MESSAGE_DEDUP_TTL_SECONDS,
      'NX',
    );
    return result === 'OK' ? key : null;
  }

  private async releaseClaim(key: string) {
    try {
      await this.redisService.redis.del(key);
    } catch (error) {
      this.logger.warn(
        `[VK][unread-recovery] failed to release claim ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyAboutRecovery(peerId: number) {
    await this.withRateLimitWait(
      'messages.send',
      async () =>
        await this.bot.api.messages.send({
          random_id: getRandomId(),
          peer_id: peerId,
          message: i18n.t('ru', LocalePhrase.Page_Vk_UnreadRecovery),
        }),
    );
  }

  private async replayMessage(
    groupId: number,
    candidate: UnreadMessageRecoveryCandidate,
  ) {
    // `messages.getConversations` usually returns peer_id, but the
    // middleware chain needs it unconditionally for an emulated update.
    const message = { ...candidate.message, peer_id: candidate.peerId };
    await this.bot.updates.handleWebhookUpdate({
      type: 'message_new',
      group_id: groupId,
      object: {
        client_info: UNREAD_RECOVERY_CLIENT_INFO,
        message,
      },
    });
  }

  private async replayUnavailableUserMessage(
    groupId: number,
    candidate: UnreadMessageRecoveryCandidate,
  ) {
    try {
      await this.replayMessage(groupId, candidate);
    } catch (error) {
      this.logger.warn(
        `[VK][unread-recovery] failed to persist unavailable peer=${candidate.peerId} message=${candidate.message.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** VK не сообщает retry_after для общего rate limit, поэтому ждём одну секунду. */
  private async withRateLimitWait<T>(
    operation: string,
    execute: () => Promise<T>,
  ) {
    while (true) {
      try {
        return await execute();
      } catch (error) {
        if (!(error instanceof APIError) || !isVkRateLimitError(error)) {
          throw error;
        }

        this.logger.warn(
          `[VK][unread-recovery] ${operation} rate limited; waiting ${UNREAD_RECOVERY_REQUEST_INTERVAL_MS} ms before retrying`,
        );
        await this.wait(UNREAD_RECOVERY_REQUEST_INTERVAL_MS);
      }
    }
  }
}
