import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { MiddlewareObj } from 'telegraf/typings/middleware';

import { SocialType } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { ConcurrencyService } from '../../concurrency/concurrency.service';
import { SocialService } from '../../social/social.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class UserMiddleware implements MiddlewareObj<IContext> {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly concurrencyService: ConcurrencyService,
    private readonly socialService: SocialService,
  ) {}

  middleware() {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      ctx.session ??= {};
      // ??
      if (!ctx.from) return;

      const from = ctx.from;
      const telegramId = from.id;
      await this.concurrencyService.queueLocal(
        this.concurrencyService.buildKey('middleware:user', telegramId),
        async () => {
          let userSocial = await this.userService.findBySocialId(
            SocialType.Telegram,
            telegramId,
          );
          if (!userSocial) {
            userSocial = await this.userService.createUserSocial(
              SocialType.Telegram,
              {
                username: from.username,
                socialId: telegramId,
                displayname:
                  `${from.first_name} ${from.last_name || ''}`
                    .trim()
                    .slice(0, 64) || null,
                // avatarUrl: ctx.from.,
                hasDM: ctx.chat?.type === 'private',
              },
            );
          }

          ctx.userSocial = userSocial;
          ctx.user = userSocial.user;

          if (!userSocial.hasDM && ctx.chat?.type === 'private') {
            userSocial.hasDM = true;
          }
        },
      );

      if (ctx.userSocial.isBlockedBot) {
        ctx.userSocial.isBlockedBot = false;
        await this.userService.saveUserSocial(ctx.userSocial);
      }

      if (ctx.user?.isBanned) {
        await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Common_Banned));
        return;
      }

      if (ctx.chat?.type && ctx.chat.type !== 'private') {
        try {
          let conversation = await this.socialService.findConversationById(
            SocialType.Telegram,
            ctx.chat.id,
          );
          if (!conversation) {
            conversation = await this.socialService.createConversation(
              SocialType.Telegram,
              {
                conversationId: ctx.chat.id,
                title: ctx.chat.title,
              },
              ctx.userSocial,
            );
          }

          // Link user to conversation
          this.socialService
            .iAmInConversation(ctx.userSocial, conversation.id)
            .catch((err) =>
              console.error(
                '[TG][socialService=>iAmInConversation] Error: ',
                err,
              ),
            );

          ctx.conversation = conversation;
        } catch (err) {
          console.error('[TG][socialService] Error: ', err);
        }
      }

      try {
        await next();
      } finally {
        if (ctx.userSocial && !ctx.noUpdateUserSocial) {
          // * Фикс вызова перезаписи при пустом юезре
          if (ctx.userSocial.user === null) {
            delete ctx.userSocial.user;
          }
          await this.userService.saveUserSocial(ctx.userSocial);
        }
        if (ctx.conversation) {
          await this.socialService.saveConversation(ctx.conversation);
        }
      }
    };
  }
}
