import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectBot } from '@xtcry/nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { SOCIAL_TELEGRAM_ADMIN_IDS } from '@my-environment';
import { IContext } from '@my-interfaces/telegram';

import { YSTUtyService } from '../ystuty/ystuty.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() public readonly bot: Telegraf,
    private readonly redisService: RedisService,
    private readonly ystutyService: YSTUtyService,
  ) {}

  async onModuleInit() {
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
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'day', description: 'Расписание на день' },
        { command: 'week', description: 'Расписание на неделю' },
      ]);
      this.bot.launch().catch((err) => this.logger.error(err));
      this.logger.log('[Bot] Started');
      await this.notifyAdmin('🚀 BotServer is running');
    } catch (err) {
      this.logger.error(err);
    }
  }

  public async shutdown(signal: string) {
    await this.notifyAdmin(`⚠️ BotServer shutdown [${signal}]`);
  }

  public async sendMessage(
    chatId: number,
    text: string,
    extra: ExtraReplyMessage = {},
  ) {
    try {
      return await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (err) {}
  }

  public async notifyAdmin(message: string, extra: ExtraReplyMessage = {}) {
    const adminIds = SOCIAL_TELEGRAM_ADMIN_IDS;
    // TODO: FIX BIG SPAM
    for (const uid of adminIds) {
      await this.sendMessage(uid, message, {
        disable_notification: true,
        ...extra,
      });
    }
  }

  public parseChatTitle(ctx: IContext, str: string) {
    const groupName = this.ystutyService.parseGroupName(str);
    if (groupName) {
      ctx.sessionConversation.selectedGroupName = groupName;
      this.logger.log(`Group name automation selected: "${groupName}"`);
      ctx.replyWithHTML(
        `Group name automation selected: <code>${groupName}</code>`,
        {
          reply_to_message_id: ctx.message?.message_id,
          allow_sending_without_reply: true,
        },
      );
      return true;
    } else {
      this.logger.log(`Group name not found from "${str}"`);
    }
    return false;
  }

  public async emulateSession(
    socialId: number,
  ): Promise<[IContext['session'], () => Promise<void>]> {
    const lock = await this.redisService.redlock.lock(
      `emulateSession:telegram:${socialId}`,
      10e3,
    );

    const sessionJson = await this.redisService.redis.get(
      `tg:session:${socialId}:${socialId}`,
    );
    if (!sessionJson) {
      return [null, async () => void 0];
    }

    let session: IContext['session'] = {};
    try {
      session = JSON.parse(sessionJson);
    } catch {}

    const close = async () => {
      try {
        if (Object.keys(session).length > 0) {
          await this.redisService.redis.set(
            `tg:session:${socialId}:${socialId}`,
            JSON.stringify(session),
          );
        } else {
          await this.redisService.redis.del(
            `tg:session:${socialId}:${socialId}`,
          );
        }
      } finally {
        await lock.unlock();
      }
    };
    return [session, close];
  }
}
