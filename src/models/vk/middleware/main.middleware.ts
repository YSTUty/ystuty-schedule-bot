import { Inject, Injectable, Logger } from '@nestjs/common';
import { VK_HEAR_MANAGER, VK_SCENE_MANAGER } from 'nestjs-vk';

import { HearManager } from '@vk-io/hear';
import { SceneManager } from '@vk-io/scenes';
import { SessionManager } from '@vk-io/session';
import { Middleware, MiddlewareReturn, NextMiddleware } from 'middleware-io';
import {
  Composer,
  Context,
  getRandomId,
  IMessageContextSendOptions,
  MessageContext,
  MessageEventAction,
  MessageSource,
} from 'vk-io';
import { RedisStorage } from 'vk-io-redis-storage';
import { MessagesDeleteParams } from 'vk-io/lib/api/schemas/params';

import { SocialType } from '@my-common/constants';
import { i18n } from '@my-common/util/vk';
import { LocalePhrase } from '@my-interfaces';
import {
  IContext,
  IMessageContext,
  IMessageEventContext,
} from '@my-interfaces/vk';

import { MetricsService } from '../../metrics/metrics.service';
import { RedisService } from '../../redis/redis.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { SocialService } from '../../social/social.service';
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
    private readonly scheduleService: ScheduleService,
    private readonly userService: UserService,
    private readonly socialService: SocialService,
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

  get middlewaresBefore(): Middleware<Context> {
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

  get middlewaresAfter(): Middleware<Context> {
    const composer = Composer.builder<Context>();

    composer.use(this.unhandledMessageEventMiddleware);
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

      if (!ctx.peerId) {
        this.logger.warn(`[VK] Empty ctx.peerId from ctx type(${ctx.type})`);
        this.logger.debug(JSON.stringify(ctx.toJSON()));
        // ! Прерываем выполнение, если нет peerId, так как это может привести к ошибкам при сохранении сессии и другим проблемам.
        return;
      }

      ctx.isMessageEventContext = function (
        this: IContext,
      ): this is IMessageEventContext {
        // 'eventPayload' in ctx && 'answer' in ctx
        return this.is(['message_event']);
      };
      ctx.isMessageContext = function (
        this: IContext,
      ): this is IMessageContext {
        return this.is(['message_new', 'message_edit', 'message_reply']);
      };
      ctx.editMessage = async ({ message, keyboard }) => {
        if (!ctx.isMessageEventContext()) {
          return;
        }
        return ctx.api.messages.edit({
          peer_id: ctx.peerId,
          cmid: ctx.conversationMessageId,
          message,
          keyboard,
        });
      };

      // * redefine vk-io ctx features
      const getPeerType = (id: number) =>
        2e9 < id
          ? MessageSource.CHAT
          : id < 0
            ? MessageSource.GROUP
            : MessageSource.USER;
      const defineGetter = <T extends object>(
        target: T,
        key: PropertyKey,
        get: () => unknown,
      ) => {
        if (key in target) return;

        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: true,
          get,
        });
      };

      defineGetter(ctx, 'peerType', () => getPeerType(ctx.peerId));
      defineGetter(ctx, 'isDM', () =>
        [MessageSource.USER, MessageSource.GROUP].includes(ctx.peerType),
      );
      defineGetter(ctx, 'isChat', () => ctx.peerType === MessageSource.CHAT);
      defineGetter(ctx, 'chatId', () =>
        ctx.isChat ? ctx.peerId - 2e9 : undefined,
      );

      if (ctx.isMessageEventContext()) {
        const answer = ctx.answer.bind(ctx);
        ctx.answer = async (eventData: MessageEventAction) => {
          const res = await answer(eventData);
          ctx.state.eventAnswered = true;
          return res;
        };
        ctx.reply = async (
          text: string | IMessageContextSendOptions,
          params?: IMessageContextSendOptions,
        ) => {
          const forwardOptions = ctx.conversationMessageId
            ? { conversation_message_ids: ctx.conversationMessageId }
            : { message_ids: ctx.id };
          return ctx.send({
            forward: JSON.stringify({
              ...forwardOptions,
              peer_id: ctx.peerId,
              is_reply: true,
            }),
            ...(typeof text !== 'object' ? { message: text, ...params } : text),
          });
        };

        ctx.deleteMessage = async (
          options: Partial<MessagesDeleteParams> = {},
        ) => {
          const convMid = ctx.conversationMessageId;
          const target = !!convMid
            ? { peer_id: ctx.peerId, cmids: convMid }
            : { message_ids: ctx.id };
          const messageIds = await ctx.api.messages.delete({
            ...options,
            ...target,
          });
          return messageIds;
        };
      } else if (ctx.is(['message'])) {
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
      } catch (err: unknown) {
        this.logger.error('Error (featureMiddleware):', err);
        try {
          await ctx.reply(ctx.i18n.t(LocalePhrase.Common_Error));
        } catch {}
        throw err;
      }
    };
  }

  /** Подтверждает callback, который не обработал ни один VK handler. */
  private get unhandledMessageEventMiddleware() {
    return async (ctx: IContext, next: NextMiddleware) => {
      await next?.();

      if (!ctx.isMessageEventContext() || ctx.state.eventAnswered) {
        return;
      }

      await ctx.answer({
        type: 'show_snackbar',
        text: 'Nope ¯\\_(ツ)_/¯',
      });
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
    if (!session) return;

    // i18n
    if (session['__language_code'] === 'ru') {
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

      if (ctx.isMessageContext()) {
        if (ctx.replyMessage?.$groupId === ctx.$groupId) {
          ctx.state.appeal = true;
        }

        if (ctx.text) {
          const triggerMsg = ctx.text.match(triggerRegexp);
          if (triggerMsg) {
            ctx.text = ctx.text.slice(triggerMsg[0].length);
            ctx.state.appeal = true;
          }
        }
      }
      return next();
    };
  }

  private sceneInterceptMiddleware() {
    return async (
      ctx: IMessageContext | IMessageEventContext,
      next: NextMiddleware,
    ) => {
      // * Тут доработали логику `this.sceneManager.middlewareIntercept`, что перед входом в сцену проверяем команду "Отмены". Этого можно не делать, если в каждой сцене наследовать класс с обработкой команд выхода из сцены
      if (!ctx.scene.current) {
        return next();
      }

      const payloadPhrase = ctx.eventPayload?.phrase as
        | LocalePhrase
        | undefined;

      const phraseKey = LocalePhrase.Button_Cancel;
      const normalizedText = (payloadPhrase || ctx.text)
        ?.trim()
        .toLocaleLowerCase('ru');
      const cancelButtonText = ctx.i18n
        .t(phraseKey)
        .trim()
        .toLocaleLowerCase('ru');
      const isCancel =
        payloadPhrase === phraseKey ||
        normalizedText === cancelButtonText ||
        ['cancel', '/cancel', 'exit', '/exit'].includes(normalizedText || '');

      if (isCancel) {
        const keyboard = this.keyboardFactory.getStart(ctx); // getClose(ctx);
        await ctx.send(ctx.i18n.t(LocalePhrase.Common_Canceled), {
          keyboard,
        });
        if ('eventPayload' in ctx) {
          ctx.deleteMessage({ delete_for_all: true }).catch();
          // ctx.answer({ type: 'show_snackbar', text: 'Отменено' }).catch();
        }
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
          const [userInfo] = await ctx.api.users.get({
            user_ids: [ctx.senderId.toString()],
            fields: ['domain', 'photo_200'],
          });

          userSocial = await this.userService.createUserSocial(
            SocialType.Vkontakte,
            {
              username: userInfo.domain,
              socialId: userInfo.id,
              avatarUrl: userInfo.photo_200,
              displayname:
                `${userInfo.first_name || ''} ${userInfo.last_name || ''}`
                  .trim()
                  .slice(0, 64) || null,
              hasDM: ctx.isDM,
            },
          );
        }
      }

      if (!userSocial) {
        await ctx.send(ctx.i18n.t(LocalePhrase.Common_Error));
        return;
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

      if (ctx.isChat && ctx.chatId) {
        try {
          let conversation = await this.socialService.findConversationById(
            SocialType.Vkontakte,
            ctx.chatId,
          );
          if (!conversation) {
            conversation = await this.socialService.createConversation(
              SocialType.Vkontakte,
              { conversationId: ctx.chatId },
              ctx.state.userSocial,
            );
          }

          if (ctx.state.userSocial) {
            // Link user to conversation
            this.socialService
              .iAmInConversation(ctx.state.userSocial, conversation.id)
              .catch((err) => {
                if (err instanceof Error) {
                  this.logger.error(
                    '[VK][socialService=>iAmInConversation] Error',
                    err.stack,
                  );
                  return;
                }

                this.logger.error(
                  `[VK][socialService=>iAmInConversation] Error: ${String(err)}`,
                );
              });
          }

          ctx.state.conversation = conversation;
        } catch (err) {
          if (err instanceof Error) {
            this.logger.error('[VK][socialService] Error', err.stack);
          } else {
            this.logger.error(`[VK][socialService] Error: ${String(err)}`);
          }
        }
      }

      try {
        await next();
      } finally {
        if (ctx.state.userSocial && !ctx.state.noUpdateUserSocial) {
          // * Фикс вызова перезаписи при пустом юезре
          if (ctx.state.userSocial.user === null) {
            delete ctx.state.userSocial.user;
          }
          await this.userService.saveUserSocial(ctx.state.userSocial);
        }
        if (ctx.state.conversation) {
          await this.socialService.saveConversation(ctx.state.conversation);
        }
      }
    };
  }

  private middlewareRefValue() {
    return async (ctx: IMessageContext, next: NextMiddleware) => {
      const msgPayload = ctx.referralValue?.split('_');
      if (msgPayload && msgPayload.length > 1) {
        if (msgPayload[0] === 'g') {
          const groupNameTest = msgPayload.slice(1).join('_');

          const groupName =
            this.scheduleService.parseGroupName(groupNameTest) ||
            this.scheduleService.parseGroupName(
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
