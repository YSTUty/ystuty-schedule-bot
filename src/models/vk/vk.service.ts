import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectVkApi } from 'nestjs-vk';

import { getRandomId, VK } from 'vk-io';
import { MessagesConversationMember } from 'vk-io/lib/api/schemas/objects';
import { MessagesSendParams } from 'vk-io/lib/api/schemas/params';

import * as xEnv from '@my-environment';

import { IContext, IMessageContext } from '@my-interfaces/vk';

import { RedisService } from '../redis/redis.service';
import { ScheduleService } from '../schedule/schedule.service';

const CONVERSATION_MEMBERS_CACHE_TTL_SECONDS = 120;
type CachedConversationMember = Pick<
  MessagesConversationMember,
  'member_id' | 'is_admin' | 'is_owner'
>;

@Injectable()
export class VkService implements OnModuleInit {
  private readonly logger = new Logger(VkService.name);

  constructor(
    @InjectVkApi() public readonly bot: VK,
    private readonly redisService: RedisService,
    public readonly scheduleService: ScheduleService,
  ) {}

  public get isActive(): boolean {
    return !!xEnv.SOCIAL_VK_GROUP_TOKEN && !!xEnv.SOCIAL_VK_GROUP_ID;
  }

  async onModuleInit() {
    if (!this.isActive) return;
    this.launch().catch((e) => this.logger.error(e));
  }

  public async launch() {
    try {
      this.bot.updates.start().catch((err) => this.logger.error(err));
      this.logger.log('[Bot] Started');
      // await this.notifyAdmin('🚀 BotServer is running');
    } catch (err) {
      this.logger.error(err);
    }
  }

  public async sendMessage(
    peer_id: number,
    message: string,
    extra: MessagesSendParams = {},
  ) {
    if (!this.isActive) return false;
    try {
      return await this.bot.api.messages.send({
        random_id: getRandomId(),
        peer_id,
        message,
        ...extra,
      });
    } catch (err) {
      this.logger.error(err);
      return false;
    }
  }

  public async tryEditOrSendMessage(
    peer_id: number,
    msgId: { conversation_message_id: number } | { message_id: number },
    message: string,
    extra: MessagesSendParams = {},
  ) {
    if (!this.isActive) return false;
    try {
      return await this.bot.api.messages.edit({
        ...msgId,
        peer_id,
        message,
        ...extra,
      });
    } catch {
      return await this.sendMessage(peer_id, message, extra);
    }
  }

  public async notifyAdmin(message: string, extra: MessagesSendParams = {}) {
    if (!this.isActive) return;
    this.logger.debug(`Notify admin: ${message}`);

    const adminIds = xEnv.SOCIAL_VK_ADMIN_IDS;
    // TODO: FIX BIG SPAM
    for (const uid of adminIds) {
      await this.sendMessage(uid, message, extra);
    }
  }

  public async parseChatTitle(ctx: IMessageContext, str: string) {
    const groupName = this.scheduleService.parseGroupName(str);
    if (groupName) {
      if (ctx.state.conversation) {
        ctx.state.conversation.groupName = groupName;
      }
      this.logger.log(`Group name automation selected: "${groupName}"`);
      await ctx.send(`Учебная группа выбрана автоматически: ${groupName}`);
      return true;
    } else {
      this.logger.log(`Group name not found from "${str}"`);
    }
    return false;
  }

  public async emulateSession(
    socialId: number,
    _chatId?: number | null,
  ): Promise<
    [OmitT<IContext['session'], '$forceUpdate()'> | null, () => Promise<void>]
  > {
    if (!this.isActive) return [null, async () => void 0];

    const lock = await this.redisService.redlock.lock(
      `emulateSession:telegram:${socialId}`,
      10e3,
    );

    try {
      const key = `vk:session:${socialId}:${socialId}`;
      const sessionJson = await this.redisService.redis.get(key);
      if (!sessionJson) {
        await lock.unlock();
        return [null, async () => void 0];
      }

      let session: OmitT<IContext['session'], '$forceUpdate()'> = {};
      try {
        session = JSON.parse(sessionJson);
      } catch {}

      const close = async () => {
        try {
          if (session && Object.keys(session).length > 0) {
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

  public async getCachedConvMembers(peerId: number) {
    const cacheKey = `vk:conversation-members:${peerId}`;
    const cachedMembers = await this.redisService.redis.get(cacheKey);
    if (cachedMembers) {
      return JSON.parse(cachedMembers) as CachedConversationMember[];
    }

    const { items } = await this.bot.api.messages.getConversationMembers({
      peer_id: peerId,
    });
    const cachedValue: CachedConversationMember[] = items.map((item) => ({
      member_id: item.member_id,
      is_admin: item.is_admin,
      is_owner: item.is_owner,
    }));
    await this.redisService.redis.set(
      cacheKey,
      JSON.stringify(cachedValue),
      'EX',
      CONVERSATION_MEMBERS_CACHE_TTL_SECONDS,
    );
    return cachedValue;
  }
}
