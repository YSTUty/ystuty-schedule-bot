import { Injectable, Logger } from '@nestjs/common';
import { InjectVkApi } from 'nestjs-vk';
import { VK, getRandomId } from 'vk-io';
import { MessagesSendParams } from 'vk-io/lib/api/schemas/params';

import * as xEnv from '@my-environment';
import { IContext, IMessageContext } from '@my-interfaces/vk';

import { YSTUtyService } from '../ystuty/ystuty.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class VkService {
  private readonly logger = new Logger(VkService.name);

  constructor(
    @InjectVkApi() public readonly bot: VK,
    private readonly redisService: RedisService,
    public readonly ystutyService: YSTUtyService,
  ) {}

  public async sendMessage(
    peer_id: number,
    message: string,
    extra: MessagesSendParams = {},
  ) {
    try {
      return await this.bot.api.messages.send({
        random_id: getRandomId(),
        peer_id,
        message,
        ...extra,
      });
    } catch (err) {}
  }

  public async tryEditOrSendMessage(
    peer_id: number,
    msgId: { conversation_message_id: number } | { message_id: number },
    message: string,
    extra: MessagesSendParams = {},
  ) {
    try {
      return await this.bot.api.messages.edit({
        ...msgId,
        peer_id,
        message,
        ...extra,
      });
    } catch (err) {
      return await this.sendMessage(peer_id, message, extra);
    }
  }

  public async notifyAdmin(message: string, extra: MessagesSendParams = {}) {
    this.logger.debug(`Notify admin: ${message}`);

    const adminIds = xEnv.SOCIAL_VK_ADMIN_IDS;
    // TODO: FIX BIG SPAM
    for (const uid of adminIds) {
      await this.sendMessage(uid, message, extra);
    }
  }

  public parseChatTitle(ctx: IMessageContext, str: string) {
    const groupName = this.ystutyService.parseGroupName(str);
    if (groupName) {
      ctx.sessionConversation.selectedGroupName = groupName;
      this.logger.log(`Group name automation selected: "${groupName}"`);
      ctx.send(`Group name automation selected: ${groupName}`);
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
      `vk:session:${socialId}:${socialId}`,
    );
    if (!sessionJson) {
      return [null, async () => void 0];
    }

    let session: IContext['session'];
    try {
      session = JSON.parse(sessionJson);
    } catch {}

    const close = async () => {
      try {
        if (Object.keys(session).length > 0) {
          await this.redisService.redis.set(
            `vk:session:${socialId}:${socialId}`,
            JSON.stringify(session),
          );
        } else {
          await this.redisService.redis.del(
            `vk:session:${socialId}:${socialId}`,
          );
        }
      } finally {
        await lock.unlock();
      }
    };
    return [session, close];
  }
}
