import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { InjectBot } from '@xtcry/nestjs-telegraf';

import { Telegraf } from 'telegraf';
import { ChatMember } from 'telegraf/typings/core/types/typegram';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';

import * as xEnv from '@my-environment';

import { UserRole } from '@my-common/constants';
import { IContext } from '@my-interfaces/telegram';

import { RedisService } from '../redis/redis.service';
import { ScheduleService } from '../schedule/schedule.service';

const CHAT_ADMINS_CACHE_TTL_SECONDS = 120;
type CachedChatAdmin = {
  user: { id: ChatMember['user']['id'] };
  status: ChatMember['status'];
};

type PrivateChatCommandsParams = {
  chatId: number;
  isAuthorized: boolean;
  isAdmin: boolean;
  hasGroup?: boolean;
  teacherId?: number;
};

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() public readonly bot: Telegraf,
    private readonly redisService: RedisService,
    private readonly scheduleService: ScheduleService,
  ) {}

  public get isActive(): boolean {
    return !!xEnv.SOCIAL_TELEGRAM_BOT_TOKEN;
  }

  async onModuleInit() {
    if (!this.isActive) return;
    this.launch().catch((e) => this.logger.error(e));
  }

  async onApplicationShutdown(signal: string) {
    await this.shutdown(signal);
  }

  public async launch() {
    this.bot.catch((err: Error, ctx) => {
      this.logger.error(`OnUpdateType(${ctx?.updateType}): ${err}`, err.stack);
    });

    try {
      await this.bot.telegram.setMyCommands(this.baseCommands());
      this.bot
        .launch({
          allowedUpdates: [
            'message',
            'message_reaction',
            'message_reaction_count',
            'inline_query',
            'callback_query',
            'chat_member',
            'my_chat_member',
          ],
        })
        .catch((err) => this.logger.error(err));
      this.logger.log('[Bot] Started');
      await this.notifyAdmin('🚀 BotServer is running');
    } catch (err) {
      this.logger.error(err);
    }
  }

  public baseCommands(type?: 'start' | 'end') {
    const start = [
      { command: 'start', description: 'Запустить бота' },
      { command: 'day', description: 'Расписание на день' },
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
    await this.notifyAdmin(`⚠️ BotServer shutdown [${signal}]`);
  }

  public async sendMessage(
    chatId: number,
    text: string,
    extra: ExtraReplyMessage = {},
  ) {
    if (!this.isActive) return false;
    try {
      return await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (err) {
      this.logger.error(err);
      return false;
    }
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
    const lock = await this.redisService.redlock.lock(
      `emulateSession:telegram:${socialId}`,
      10e3,
    );

    try {
      const key = `tg:session:${socialId}:${socialId}`;
      const sessionJson = await this.redisService.redis.get(key);
      if (!sessionJson) {
        await lock.unlock();
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
          await lock.unlock();
        }
      };
      return [session, close];
    } catch (err) {
      await lock.unlock();
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
}
