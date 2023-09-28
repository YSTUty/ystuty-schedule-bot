import { Inject, Injectable, Logger } from '@nestjs/common';
import { VK_HEAR_MANAGER, VK_SCENE_MANAGER } from 'nestjs-vk';
import {
  MessageContext,
  Context,
  Composer,
  IMessageContextSendOptions,
  getRandomId,
} from 'vk-io';
import { HearManager } from '@vk-io/hear';
import { SessionManager } from '@vk-io/session';
import { SceneManager } from '@vk-io/scenes';
import { RedisStorage } from 'vk-io-redis-storage';
import { NextMiddleware, MiddlewareReturn } from 'middleware-io';

import { SocialType } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/vk';
import { checkLocaleCondition, i18n } from '@my-common/util/vk';

import { MetricsService } from '../../metrics/metrics.service';
import { RedisService } from '../../redis/redis.service';
import { YSTUtyService } from '../../ystuty/ystuty.service';
import { UserService } from '../../user/user.service';

import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../vk.constants';

@Injectable()
export class MainMiddleware {
  private readonly logger = new Logger(MainMiddleware.name);

  private readonly sessionManager: SessionManager;
  private readonly sessionConversationManager: SessionManager;

  private readonly redisStorage: RedisStorage;

  @Inject(VK_HEAR_MANAGER)
  private readonly hearManagerProvider: HearManager<MessageContext>;

  @Inject(VK_SCENE_MANAGER)
  private readonly sceneManager: SceneManager;

  constructor(
    private readonly keyboardFactory: VKKeyboardFactory,
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
    private readonly ystutyService: YSTUtyService,
    private readonly userService: UserService,
  ) {
    this.redisStorage = new RedisStorage({
      redis: this.redisService.redis,
      ttl: 3 * 7 * 24 * 3600,
    });

    this.sessionManager = new SessionManager({
      storage: this.redisStorage,
      getStorageKey: (ctx: IContext) =>
        `vk:session:${ctx.peerId}:${ctx.senderId || ctx.userId}`,
    });

    this.sessionConversationManager = new SessionManager({
      contextKey: 'sessionConversation',
      storage: this.redisStorage,
      getStorageKey: (ctx: IContext) => `vk:session:conversation:${ctx.peerId}`,
    });
  }

  get middlewaresBefore() {
    const composer = Composer.builder<Context>();

    composer.use(this.featureMiddleware);
    composer.use(this.middlewareMetrics);
    composer.use(this.safeTextConverstionMiddleware);
    composer.use(this.sessionManager.middleware);
    composer.use(this.sessionConversationManager.middleware);
    composer.use(this.middlewareCleaner);
    composer.use(i18n.middleware);
    composer.use(this.sceneManager.middleware);
    composer.use(this.userMiddleware);
    composer.use(this.middlewareRefValue());

    return composer.compose();
  }

  get middlewaresAfter() {
    const composer = Composer.builder<Context>();

    composer.use(this.sceneInterceptMiddleware());
    composer.use(this.hearManagerProvider.middleware);

    return composer.compose();
  }

  private get middlewareMetrics() {
    return async (
      ctx: IContext,
      next: NextMiddleware,
    ): Promise<MiddlewareReturn> => {
      const { type: updateType } = ctx;
      const duration =
        this.metricsService.vkRequestDurationHistogram.startTimer({
          updateType,
        });

      try {
        await next?.();
        this.metricsService.vkRequestCounter.inc({
          updateType,
          status: 'success',
        });
        duration({ status: 'success' });
      } catch (err) {
        this.metricsService.vkRequestCounter.inc({
          updateType,
          status: 'error',
        });
        duration({ status: 'error' });
        throw err;
      } finally {
        // duration();
      }
      return;
    };
  }

  private get featureMiddleware() {
    return async (
      ctx: IContext,
      next: NextMiddleware,
    ): Promise<MiddlewareReturn> => {
      if (ctx.isOutbox) {
        return;
      }
      if (ctx.is(['message'])) {
        // ...
      } else {
        // * safe `send` method for all context events
        ctx.send = (
          text: string | IMessageContextSendOptions,
          params?: IMessageContextSendOptions,
        ) =>
          ctx.api.messages.send({
            random_id: getRandomId(),
            peer_ids: ctx.peerId,
            ...(typeof text === 'string' ? { message: text, ...params } : text),
          });
      }

      try {
        await next();
      } catch (error) {
        this.logger.error('Error:', error);
      }
    };
  }

  public get middlewareCleaner() {
    return async (ctx: IContext, next: NextMiddleware) => {
      await next?.();
      this.cleanSession(ctx);
    };
  }

  private cleanSession(ctx: IContext) {
    const { session } = ctx;

    // i18n
    if (session?.__language_code === 'ru') {
      delete session['__language_code'];
    }
  }

  private get safeTextConverstionMiddleware() {
    return (ctx: IContext, next: NextMiddleware) => {
      const triggerRegexp = new RegExp(
        `^\\[club${ctx.$groupId}\\|(.*?)\\],? `,
        'i',
      );
      ctx.state.appeal = false;

      if (ctx.text && triggerRegexp.test(ctx.text)) {
        const triggerMsg = ctx.text.match(triggerRegexp);
        ctx.text = ctx.text.slice(triggerMsg[0].length);
        ctx.state.appeal = true;
      }
      return next();
    };
  }

  private sceneInterceptMiddleware() {
    return async (ctx: IMessageContext, next: NextMiddleware) => {
      if (!ctx.scene.current) {
        return next();
      }

      if (checkLocaleCondition([LocalePhrase.Button_Cancel])(ctx.text, ctx)) {
        const keyboard = this.keyboardFactory.getClose(ctx);
        ctx.send(ctx.i18n.t(LocalePhrase.Common_Canceled), {
          keyboard,
        });
        return ctx.scene.leave({ canceled: true });
      }

      return ctx.scene.reenter();
    };
  }

  private get userMiddleware() {
    return async (ctx: IContext | IMessageContext, next: NextMiddleware) => {
      if (!ctx.peerId /* || ctx.peerType !== 'user' */) {
        return;
      }

      let userSocial = await this.userService.findBySocialId(
        SocialType.Vkontakte,
        ctx.senderId || ctx.userId,
      );
      if (!userSocial) {
        if (ctx.is(['message'])) {
          const [userInfo] = (await ctx.api.users.get({
            user_ids: [ctx.senderId.toString()],
            fields: ['domain', 'photo_200'],
          })) as [
            {
              id: number;
              domain: string;
              first_name: string;
              last_name: string;
              photo_200: string;
              can_access_closed: boolean;
              is_closed: boolean;
            },
          ];

          userSocial = await this.userService.createUserSocial(
            SocialType.Vkontakte,
            {
              username: userInfo.domain,
              socialId: userInfo.id,
              avatarUrl: userInfo.photo_200,
            },
            // { fullname: `${userInfo.first_name} ${userInfo.last_name}`.trim() },
          );
        }
      }

      ctx.state.userSocial = userSocial;
      ctx.state.user = userSocial.user;

      if (!userSocial.hasDM && ctx.isDM) {
        userSocial.hasDM = true;
      }

      if (ctx.state.userSocial.isBlockedBot) {
        ctx.state.userSocial.isBlockedBot = false;
        await this.userService.saveUserSocial(ctx.state.userSocial);
      }

      if (ctx.state.user?.isBanned) {
        await ctx.send(ctx.i18n.t(LocalePhrase.Common_Banned));
        return;
      }

      // TODO!: remove it after pair months
      if (ctx.session.selectedGroupName && !ctx.state.userSocial.groupName) {
        ctx.state.userSocial.groupName = ctx.session.selectedGroupName;
        delete ctx.session.selectedGroupName;
      }

      try {
        await next();
      } finally {
        if (ctx.state.userSocial) {
          await this.userService.saveUserSocial(ctx.state.userSocial);
        }
      }
    };
  }

  private middlewareRefValue() {
    return async (ctx: IMessageContext, next: NextMiddleware) => {
      const msgPayload = ctx.referralValue?.split('_');
      if (msgPayload?.length > 1) {
        if (msgPayload[0] === 'g') {
          const groupNameTest = msgPayload.slice(1).join('_');

          const groupName =
            this.ystutyService.parseGroupName(groupNameTest) ||
            this.ystutyService.parseGroupName(
              Buffer.from(groupNameTest, 'base64').toString(),
            );
          if (groupName) {
            ctx.state.foundGroupName = groupName;
          }
        }
      }

      await next?.();

      if (ctx.state.foundGroupName && ctx.state.rejectRefGroupName !== true) {
        await ctx.scene.enter(SELECT_GROUP_SCENE, {
          state: { groupName: ctx.state.foundGroupName },
        });
      }
    };
  }
}
