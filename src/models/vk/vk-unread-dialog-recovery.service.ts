import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectVkApi } from 'nestjs-vk';

import { APIError, getRandomId, VK } from 'vk-io';

import * as xEnv from '@my-environment';

import {
  delay,
  isVkRateLimitError,
  isVkUserUnavailableError,
} from '@my-common';
import { SocialType } from '@my-common/constants';
import { i18n } from '@my-common/util/vk';
import { LocalePhrase } from '@my-interfaces';

import { RedisService } from '../redis/redis.service';
import { UserService } from '../user/user.service';

const RECOVERY_DIALOGS_PAGE_SIZE = 200;
const RECOVERY_MESSAGE_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1e3;
const RECOVERY_MESSAGE_DEDUP_TTL_SECONDS = 5 * 24 * 60 * 60;
const RECOVERY_PROCESSING_TTL_SECONDS = 15 * 60;
const RECOVERY_REQUEST_INTERVAL_MS = 1e3;
const RECOVERY_DIALOG_FILTERS = ['unread', 'unanswered'] as const;
const RECOVERY_PASSES = 2;
const RECOVERY_CLIENT_INFO = {
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

type RecoveryDialogFilter = (typeof RECOVERY_DIALOG_FILTERS)[number];

type RecoveryMessageCandidate = {
  peerId: number;
  message: VkUnreadMessage;
};

type RecoveryCandidateSkipReason =
  | 'missing_message'
  | 'invalid_id'
  | 'non_dm'
  | 'outbound'
  | 'empty'
  | 'stale'
  | 'duplicate'
  | 'completed'
  | 'processing';

type RecoveryFilterStats = {
  filter: RecoveryDialogFilter;
  pages: number;
  reportedCount: number;
  items: number;
  pass: number;
};

type RecoveryStats = {
  completed: number;
  filters: RecoveryFilterStats[];
  passes: number;
  unique: number;
  eligible: number;
  claimed: number;
  processed: number;
  replayed: number;
  recoveryNotified: number;
  started: number;
  unavailable: number;
  failed: number;
  skipped: Record<RecoveryCandidateSkipReason, number>;
};

type RecoveryClaim =
  | { status: 'claimed'; processingKey: string }
  | { status: 'completed' | 'processing' };

/** Восстанавливает свежие непрочитанные или неотвеченные ЛС, которые VK не отдал после простоя polling. */
@Injectable()
export class VkUnreadDialogRecoveryService {
  private readonly logger = new Logger(VkUnreadDialogRecoveryService.name);
  protected wait = delay;
  private isProcessingLeaseRetryScheduled = false;

  constructor(
    @InjectVkApi() private readonly bot: VK,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  /** Однократно после старта пытается ответить на свежие непрочитанные и неотвеченные ЛС. */
  public async recoverUnreadDirectMessages(now = new Date()) {
    const groupId = xEnv.SOCIAL_VK_GROUP_ID;
    if (!groupId) return;

    const stats: RecoveryStats = {
      claimed: 0,
      completed: 0,
      eligible: 0,
      failed: 0,
      filters: [],
      passes: 0,
      processed: 0,
      recoveryNotified: 0,
      replayed: 0,
      skipped: this.createSkipStats(),
      started: 0,
      unavailable: 0,
      unique: 0,
    };
    const seenCandidateKeys = new Set<string>();

    for (let pass = 1; pass <= RECOVERY_PASSES; pass += 1) {
      await this.recoverPass({
        groupId,
        now,
        pass,
        seenCandidateKeys,
        stats,
      });
      stats.passes += 1;

      // Если первый snapshot не дал ни одного сообщения в работу, второй
      // проход ничего не восстановит и лишь добавит лишние VK API-вызовы.
      if (pass === 1 && stats.claimed === 0) break;
    }

    this.logRecoverySummary(stats);
    this.scheduleProcessingLeaseRetry(stats);
  }

  /**
   * При restart processing lease старого процесса ещё может быть живым.
   * Отложенный повтор даёт ему истечь, не создавая дубликат при двух живых
   * экземплярах бота и не блокируя launch VK polling.
   */
  private scheduleProcessingLeaseRetry(stats: RecoveryStats) {
    if (
      stats.skipped.processing === 0 ||
      this.isProcessingLeaseRetryScheduled
    ) {
      return;
    }

    this.isProcessingLeaseRetryScheduled = true;
    this.logger.warn(
      `[VK][unread-recovery] ${stats.skipped.processing} message(s) are still processing; retrying after ${RECOVERY_PROCESSING_TTL_SECONDS} s`,
    );
    const timer = setTimeout(() => {
      this.isProcessingLeaseRetryScheduled = false;
      void this.recoverUnreadDirectMessages().catch((error) =>
        this.logger.error(
          '[VK][unread-recovery] delayed processing-lease retry failed',
          error instanceof Error ? error.stack : String(error),
        ),
      );
    }, RECOVERY_PROCESSING_TTL_SECONDS * 1e3);
    timer.unref?.();
  }

  /**
   * Второй проход ловит сообщения, пришедшие за время последовательной
   * обработки длинной очереди. Completed marker не даёт повторно отвечать
   * на уже обработанный snapshot.
   */
  private async recoverPass({
    groupId,
    now,
    pass,
    seenCandidateKeys,
    stats,
  }: {
    groupId: number;
    now: Date;
    pass: number;
    seenCandidateKeys: Set<string>;
    stats: RecoveryStats;
  }) {
    const { dialogs, filters } = await this.readRecoveryDialogs(groupId, pass);
    stats.filters.push(...filters);
    const candidates = new Map<string, RecoveryMessageCandidate>();

    for (const dialog of dialogs) {
      const candidateResult = this.getCandidate(dialog, now);
      if (!candidateResult.candidate) {
        stats.skipped[candidateResult.reason] += 1;
        continue;
      }

      const candidate = candidateResult.candidate;
      const candidateKey = this.buildCompletedKey(
        candidate.peerId,
        candidate.message.id!,
      );
      if (candidates.has(candidateKey)) {
        stats.skipped.duplicate += 1;
        continue;
      }

      candidates.set(candidateKey, candidate);
      if (!seenCandidateKeys.has(candidateKey)) {
        seenCandidateKeys.add(candidateKey);
        stats.unique += 1;
        stats.eligible += 1;
      }
    }

    for (const candidate of candidates.values()) {
      const claim = await this.claimMessage(
        candidate.peerId,
        candidate.message.id!,
      );
      if (claim.status !== 'claimed') {
        stats.skipped[claim.status] += 1;
        continue;
      }
      stats.claimed += 1;

      try {
        const isNewSocialUser = !(await this.userService.findBySocialId(
          SocialType.Vkontakte,
          candidate.peerId,
        ));
        if (isNewSocialUser) {
          // Последнее сообщение могло быть произвольным, а не командой запуска.
          // Для нового профиля сначала эмулируем /start, чтобы отправить обычный
          // стартовый экран и дать понятную точку входа.
          await this.replayStartMessage(groupId, candidate);
          stats.replayed += 1;
          stats.started += 1;
        } else {
          await this.notifyAboutRecovery(candidate.peerId);
          stats.recoveryNotified += 1;
          await this.replayMessage(groupId, candidate);
          stats.replayed += 1;
          stats.processed += 1;
        }

        await this.markMessageCompleted(
          candidate.peerId,
          candidate.message.id!,
          claim.processingKey,
        );
        stats.completed += 1;
      } catch (error) {
        if (error instanceof APIError && isVkUserUnavailableError(error)) {
          // Сообщение уже подтверждает факт ЛС. Пропускаем его через обычный
          // маршрут, чтобы создать профиль и сохранить недоступность бота.
          try {
            await this.replayUnavailableUserMessage(groupId, candidate);
            stats.replayed += 1;
            stats.unavailable += 1;
            await this.markMessageCompleted(
              candidate.peerId,
              candidate.message.id!,
              claim.processingKey,
            );
            stats.completed += 1;
            continue;
          } catch (replayError) {
            error = replayError;
          }
        }

        await this.releaseProcessingClaim(claim.processingKey);
        stats.failed += 1;
        this.logger.warn(
          `[VK][unread-recovery] failed peer=${candidate.peerId} message=${candidate.message.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        // Не создаём burst API-вызовов, когда после простоя накопилось много ЛС.
        await this.wait(RECOVERY_REQUEST_INTERVAL_MS);
      }
    }
  }

  private async readRecoveryDialogs(groupId: number, pass: number) {
    const dialogs: VkUnreadDialog[] = [];
    const filters: RecoveryFilterStats[] = [];

    for (const filter of RECOVERY_DIALOG_FILTERS) {
      const filterResult = await this.readDialogsByFilter(
        groupId,
        filter,
        pass,
      );
      dialogs.push(...filterResult.dialogs);
      filters.push(filterResult.stats);
    }

    return { dialogs, filters };
  }

  private async readDialogsByFilter(
    groupId: number,
    filter: RecoveryDialogFilter,
    pass: number,
  ) {
    const dialogs: VkUnreadDialog[] = [];
    const stats: RecoveryFilterStats = {
      filter,
      items: 0,
      pages: 0,
      pass,
      reportedCount: 0,
    };
    let offset = 0;

    while (true) {
      const { count, items } = await this.withRateLimitWait(
        'messages.getConversations',
        async () =>
          await this.bot.api.messages.getConversations({
            count: RECOVERY_DIALOGS_PAGE_SIZE,
            filter,
            group_id: groupId,
            offset,
          }),
      );
      const page = items as VkUnreadDialog[];
      stats.items += page.length;
      stats.pages += 1;
      stats.reportedCount = count;
      dialogs.push(...page);
      offset += page.length;

      if (page.length === 0 || offset >= count) {
        return { dialogs, stats };
      }
    }
  }

  private getCandidate(
    dialog: VkUnreadDialog,
    now: Date,
  ):
    | { candidate: RecoveryMessageCandidate; reason?: never }
    | { candidate: null; reason: RecoveryCandidateSkipReason } {
    const message = dialog.last_message;
    const peerId = dialog.conversation?.peer?.id ?? message?.peer_id;
    if (!message) {
      return { candidate: null, reason: 'missing_message' };
    }

    if (
      typeof peerId !== 'number' ||
      !Number.isSafeInteger(peerId) ||
      !Number.isSafeInteger(message.id)
    ) {
      return { candidate: null, reason: 'invalid_id' };
    }

    if (peerId < 1 || peerId > 2e9) {
      return { candidate: null, reason: 'non_dm' };
    }

    if (message.from_id !== peerId || Boolean(message.out)) {
      return { candidate: null, reason: 'outbound' };
    }

    if (!message.text?.trim()) {
      return { candidate: null, reason: 'empty' };
    }

    const ageMs = now.getTime() - (message.date ?? 0) * 1e3;
    if (ageMs < 0 || ageMs > RECOVERY_MESSAGE_MAX_AGE_MS) {
      return { candidate: null, reason: 'stale' };
    }

    return { candidate: { peerId, message } };
  }

  /**
   * Completed key сохраняет совместимость с ключами предыдущей версии.
   * Processing key имеет короткий TTL: аварийно остановленный процесс не
   * блокирует обработку того же ЛС на пять дней.
   */
  private async claimMessage(
    peerId: number,
    messageId: number,
  ): Promise<RecoveryClaim> {
    const completedKey = this.buildCompletedKey(peerId, messageId);
    if (await this.redisService.redis.get(completedKey)) {
      return { status: 'completed' };
    }

    const processingKey = this.buildProcessingKey(peerId, messageId);
    const result = await this.redisService.redis.set(
      processingKey,
      '1',
      'EX',
      RECOVERY_PROCESSING_TTL_SECONDS,
      'NX',
    );
    if (result !== 'OK') {
      return (await this.redisService.redis.get(completedKey))
        ? { status: 'completed' }
        : { status: 'processing' };
    }

    // Другой worker мог завершить то же сообщение между первой проверкой и
    // захватом processing lease. Не запускаем обработчик повторно.
    if (await this.redisService.redis.get(completedKey)) {
      await this.releaseProcessingClaim(processingKey);
      return { status: 'completed' };
    }

    return { status: 'claimed', processingKey };
  }

  private async markMessageCompleted(
    peerId: number,
    messageId: number,
    processingKey: string,
  ) {
    await this.redisService.redis.set(
      this.buildCompletedKey(peerId, messageId),
      '1',
      'EX',
      RECOVERY_MESSAGE_DEDUP_TTL_SECONDS,
    );
    await this.releaseProcessingClaim(processingKey);
  }

  private async releaseProcessingClaim(key: string) {
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
    candidate: RecoveryMessageCandidate,
    text = candidate.message.text,
  ) {
    // `messages.getConversations` usually returns peer_id, but the
    // middleware chain needs it unconditionally for an emulated update.
    const message = { ...candidate.message, peer_id: candidate.peerId, text };
    await this.bot.updates.handleWebhookUpdate({
      type: 'message_new',
      group_id: groupId,
      object: {
        client_info: RECOVERY_CLIENT_INFO,
        message,
      },
    });
  }

  private async replayStartMessage(
    groupId: number,
    candidate: RecoveryMessageCandidate,
  ) {
    await this.replayMessage(groupId, candidate, '/start');
  }

  private async replayUnavailableUserMessage(
    groupId: number,
    candidate: RecoveryMessageCandidate,
  ) {
    try {
      await this.replayMessage(groupId, candidate);
    } catch (error) {
      this.logger.warn(
        `[VK][unread-recovery] failed to persist unavailable peer=${candidate.peerId} message=${candidate.message.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
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
          `[VK][unread-recovery] ${operation} rate limited; waiting ${RECOVERY_REQUEST_INTERVAL_MS} ms before retrying`,
        );
        await this.wait(RECOVERY_REQUEST_INTERVAL_MS);
      }
    }
  }

  private buildCompletedKey(peerId: number, messageId: number) {
    return `vk:unread-recovery:${peerId}:${messageId}`;
  }

  private buildProcessingKey(peerId: number, messageId: number) {
    return `${this.buildCompletedKey(peerId, messageId)}:processing`;
  }

  private createSkipStats(): Record<RecoveryCandidateSkipReason, number> {
    return {
      completed: 0,
      duplicate: 0,
      empty: 0,
      invalid_id: 0,
      missing_message: 0,
      non_dm: 0,
      outbound: 0,
      processing: 0,
      stale: 0,
    };
  }

  /** Одна сводка позволяет разбирать recovery без логирования текста пользовательских сообщений. */
  private logRecoverySummary(stats: RecoveryStats) {
    const filters = stats.filters
      .map(
        ({ filter, pass, pages, reportedCount, items }) =>
          `pass=${pass}:${filter}(pages=${pages},count=${reportedCount},items=${items})`,
      )
      .join(' ');
    const skipped = Object.entries(stats.skipped)
      .filter(([, count]) => count > 0)
      .map(([reason, count]) => `${reason}=${count}`)
      .join(',');

    this.logger.log(
      `[VK][unread-recovery] completed passes=${stats.passes} filters=${filters} unique=${stats.unique} eligible=${stats.eligible} claimed=${stats.claimed} completed=${stats.completed} notified=${stats.recoveryNotified} replayed=${stats.replayed} started=${stats.started} processed=${stats.processed} unavailable=${stats.unavailable} failed=${stats.failed} skipped=${skipped || 'none'}`,
    );
  }
}
