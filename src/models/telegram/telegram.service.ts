import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { InjectBot } from 'nestjs-telega';

import { Telegraf } from 'telegraf-hardened';
import { ChatMember, Opts } from 'telegraf-hardened/types';

import * as xEnv from '@my-environment';

import { UserRole } from '@my-common/constants';
import { IContext } from '@my-interfaces/telegram';

import { ConcurrencyService } from '../concurrency/concurrency.service';
import { RedisService } from '../redis/redis.service';
import { ScheduleService } from '../schedule/schedule.service';

const CHAT_ADMINS_CACHE_TTL_SECONDS = 120;
const SEND_MESSAGE_TIMEOUT_MS = 20e3;
const POLLING_RECONNECT_DELAY_MS = 5e3;

type CachedChatAdmin = {
  user: { id: ChatMember['user']['id'] };
  status: ChatMember['status'];
};

export type BotChatMembership = {
  isLeaved: boolean;
  chatStatus: ChatMember['status'];
};

type PrivateChatCommandsParams = {
  chatId: number;
  isAuthorized: boolean;
  isAdmin: boolean;
  hasGroup?: boolean;
  teacherId?: number;
};
type ExtraReplyMessage = Omit<Opts<'sendMessage'>, 'chat_id' | 'text'>;

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramService.name);
  private pollingLaunchPromise?: Promise<void>;
  private pollingReconnectTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(
    @InjectBot() public readonly bot: Telegraf,
    private readonly concurrencyService: ConcurrencyService,
    private readonly redisService: RedisService,
    private readonly scheduleService: ScheduleService,
  ) {}

  public get isActive(): boolean {
    return !!xEnv.SOCIAL_TELEGRAM_BOT_TOKEN;
  }

  onModuleInit() {
    if (!this.isActive) return;
    void this.launch().catch((error) => this.logger.error(error));
  }

  async onApplicationShutdown(signal: string) {
    await this.shutdown(signal);
  }

  public async launch() {
    this.isShuttingDown = false;
    this.bot.catch((err: Error, ctx) => {
      this.logger.error(`OnUpdateType(${ctx?.updateType}): ${err}`, err.stack);
    });

    try {
      await this.bot.telegram.setMyCommands(this.baseCommands());
    } catch (err) {
      // Сбой настройки меню не должен оставлять polling выключенным.
      this.logger.error('Failed to set Telegram bot commands', err);
    }

    this.startPolling();
    this.logger.log('[Bot] Started');
    await this.notifyAdmin('🚀 BotServer is running');
  }

  public baseCommands(type?: 'start' | 'end') {
    const start = [
      { command: 'start', description: 'Запустить бота' },
      { command: 'day', description: 'Расписание на день' },
      { command: 'calendar', description: 'Добавить расписание в календарь' },
      { command: 'feedback', description: 'Оставить обратную связь' },
      // { command: 'week', description: 'Расписание на неделю' },
      { command: 'cancel', description: 'Отменить текущее действие' },
    ];
    const end = [
      { command: 'institutes', description: 'Выбрать группу по институту' },
      { command: 'tlist', description: 'Выбрать преподавателя из списка' },
      { command: 'teacher', description: 'Выбрать преподавателя по ФИО' },
    ];
    return type === 'start' ? start : type === 'end' ? end : [...start, ...end];
  }

  public async shutdown(signal: string) {
    this.isShuttingDown = true;
    if (this.pollingReconnectTimer) {
      clearTimeout(this.pollingReconnectTimer);
      this.pollingReconnectTimer = undefined;
    }
    await this.notifyAdmin(`⚠️ BotServer shutdown [${signal}]`);
  }

  /**
   * `telegraf-hardened` сам повторяет ожидаемые API и сетевые ошибки.
   * Этот fallback нужен только если polling уже завершился целиком, например
   * после HTML-ответа reverse proxy вместо JSON.
   */
  private startPolling() {
    if (this.isShuttingDown || this.pollingLaunchPromise) return;

    const pollingPromise = this.bot.launch({
      allowedUpdates: [
        'message',
        'message_reaction',
        'message_reaction_count',
        'inline_query',
        'callback_query',
        'chat_member',
        'my_chat_member',
      ],
      polling: {
        retryOnConflict: true,
      },
    });

    this.pollingLaunchPromise = pollingPromise;
    void pollingPromise.then(
      () => this.handlePollingExit(),
      (error) => this.handlePollingExit(error),
    );
  }

  private handlePollingExit(error?: unknown) {
    this.pollingLaunchPromise = undefined;
    if (this.isShuttingDown) return;

    const code = this.getTelegramErrorCode(error);
    if (code === 401) {
      this.logger.error(
        '[Bot] Polling stopped permanently: Telegram rejected the bot token',
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }

    if (error) {
      this.logger.error(
        '[Bot] Polling stopped unexpectedly; scheduling reconnect',
        error instanceof Error ? error.stack : String(error),
      );
    } else {
      this.logger.warn(
        '[Bot] Polling stopped unexpectedly; scheduling reconnect',
      );
    }
    this.schedulePollingReconnect();
  }

  private schedulePollingReconnect() {
    if (this.isShuttingDown || this.pollingReconnectTimer) return;

    this.logger.warn(
      `[Bot] Reconnecting polling in ${POLLING_RECONNECT_DELAY_MS} ms`,
    );
    this.pollingReconnectTimer = setTimeout(() => {
      this.pollingReconnectTimer = undefined;
      this.startPolling();
    }, POLLING_RECONNECT_DELAY_MS);
    this.pollingReconnectTimer.unref?.();
  }

  private getTelegramErrorCode(error: unknown) {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return undefined;
    }
    const { code } = error as { code?: unknown };
    return typeof code === 'number' ? code : undefined;
  }

  public async sendMessage(
    chatId: number,
    text: string,
    extra: ExtraReplyMessage = {},
  ) {
    if (!this.isActive) return false;
    try {
      return await this.sendMessageOrThrow(chatId, text, extra);
    } catch (err) {
      this.logger.error(err);
      return false;
    }
  }

  /**
   * Отправляет фоновое сообщение без подавления Telegram API-ошибки.
   * Очередь рассылок использует исходный 429, чтобы выдержать retry_after.
   */
  public async sendMessageOrThrow(
    chatId: number,
    text: string,
    extra: ExtraReplyMessage = {},
  ) {
    if (!this.isActive) {
      throw new Error('Telegram bot is inactive');
    }
    return await this.bot.telegram.callApi(
      'sendMessage',
      {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...extra,
      },
      { signal: AbortSignal.timeout(SEND_MESSAGE_TIMEOUT_MS) },
    );
  }

  public async notifyAdmin(message: string, extra: ExtraReplyMessage = {}) {
    if (!this.isActive) return false;
    const adminIds = xEnv.SOCIAL_TELEGRAM_ADMIN_IDS;
    // TODO: FIX BIG SPAM
    for (const uid of adminIds) {
      await this.sendMessage(uid, message, {
        disable_notification: true,
        ...extra,
      });
    }
  }

  /** Синхронизирует меню команд личного чата с доступными пользователю сценариями. */
  public async syncPrivateChatCommands({
    chatId,
    isAuthorized,
    isAdmin,
    hasGroup = false,
    teacherId,
  }: PrivateChatCommandsParams) {
    const commands = this.baseCommands('start');

    if (!isAuthorized) {
      commands.push({ command: 'auth', description: 'Авторизоваться' });
    }

    if (hasGroup) {
      commands.push(
        // { command: 'day', description: 'Расписание на сегодня' },
        { command: 'week', description: 'Расписание на неделю' },
      );
    }

    if (teacherId) {
      commands.push(
        { command: 'tday', description: 'Расписание преподавателя на сегодня' },
        { command: 'tweek', description: 'Расписание преподавателя на неделю' },
      );
    }

    commands.push(...this.baseCommands('end'));

    if (isAdmin) {
      commands.push({
        command: 'broadcast',
        description: 'Управление рассылками',
      });
    }

    try {
      await this.bot.telegram.setMyCommands(commands, {
        scope: { type: 'chat', chat_id: chatId },
      });
    } catch (err) {
      this.logger.error(
        `Failed to update commands for Telegram chat ${chatId}`,
        err,
      );
    }
  }

  public isAdmin(userId: number, role?: UserRole | null) {
    return (
      xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.includes(userId) || role === UserRole.ADMIN
    );
  }

  public async parseChatTitle(ctx: IContext, str: string, allowMessage = true) {
    const groupName = this.scheduleService.parseGroupName(str);
    if (groupName) {
      if (ctx.conversation) {
        ctx.conversation.groupName = groupName;
      }
      this.logger.log(`Group name automation selected: "${groupName}"`);
      if (allowMessage) {
        await ctx.replyWithHTML(
          `Учебная группа выбрана автоматически: <code>${groupName}</code>`,
          {
            ...(ctx.message?.message_id && {
              reply_parameters: {
                message_id: ctx.message.message_id,
                allow_sending_without_reply: true,
              },
            }),
          },
        );
      }
      return true;
    } else {
      this.logger.log(`Group name not found from "${str}"`);
    }
    return false;
  }

  public async emulateSession(
    socialId: number,
  ): Promise<[IContext['session'] | null, () => Promise<void>]> {
    if (!this.isActive) return [null, async () => void 0];
    const lock = await this.concurrencyService.acquireExclusiveLocal(
      this.concurrencyService.buildKey('session:telegram', socialId),
      { timeoutMs: 10e3 },
    );

    try {
      const key = `tg:session:${socialId}:${socialId}`;
      const sessionJson = await this.redisService.redis.get(key);
      if (!sessionJson) {
        await lock.release();
        return [null, async () => void 0];
      }

      let session: IContext['session'] = {};
      try {
        session = JSON.parse(sessionJson);
      } catch {}

      const close = async () => {
        try {
          if (Object.keys(session).length > 0) {
            await this.redisService.redis.set(key, JSON.stringify(session));
          } else {
            await this.redisService.redis.del(key);
          }
        } finally {
          await lock.release();
        }
      };
      return [session, close];
    } catch (err) {
      await lock.release();
      throw err;
    }
  }

  public async getCachedChatAdmins(chatId: number) {
    const cacheKey = `telegram:chat-admins:${chatId}`;
    const cachedAdmins = await this.redisService.redis.get(cacheKey);
    if (cachedAdmins) {
      return JSON.parse(cachedAdmins) as CachedChatAdmin[];
    }

    const admins = await this.bot.telegram.getChatAdministrators(chatId);
    const cachedValue: CachedChatAdmin[] = admins.map((admin) => ({
      user: { id: admin.user.id },
      status: admin.status,
    }));
    await this.redisService.redis.set(
      cacheKey,
      JSON.stringify(cachedValue),
      'EX',
      CHAT_ADMINS_CACHE_TTL_SECONDS,
    );
    return cachedValue;
  }

  /** Запрашивает у Telegram актуальное присутствие и роль бота в беседе. */
  public async getBotChatMembership(
    chatId: number,
  ): Promise<BotChatMembership> {
    const botInfo = this.bot.botInfo || (await this.bot.telegram.getMe());
    const member = await this.bot.telegram.getChatMember(chatId, botInfo.id);
    return {
      isLeaved: member.status === 'left' || member.status === 'kicked',
      chatStatus: member.status,
    };
  }
}
