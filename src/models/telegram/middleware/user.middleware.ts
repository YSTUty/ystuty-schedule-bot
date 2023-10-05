import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { MiddlewareObj } from 'telegraf/typings/middleware';

import { SocialType } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { UserService } from '../../user/user.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class UserMiddleware implements MiddlewareObj<IContext> {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly redisService: RedisService,
  ) {}

  middleware() {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      ctx.session ??= {};

      const telegramId = ctx.from.id;
      const lock = await this.redisService.redlock.lock(
        `middleware.user.${ctx.from.id}`,
        30e3,
      );
      try {
        let userSocial = await this.userService.findBySocialId(
          SocialType.Telegram,
          telegramId,
        );
        if (!userSocial) {
          userSocial = await this.userService.createUserSocial(
            SocialType.Telegram,
            {
              username: ctx.from.username,
              socialId: telegramId,
              // avatarUrl: ctx.from.,
            },
            // { fullname: `${ctx.from.first_name} ${ctx.from.last_name}`.trim() },
          );
        }

        ctx.userSocial = userSocial;
        ctx.user = userSocial.user;

        if (!userSocial.hasDM && ctx.chat?.type === 'private') {
          userSocial.hasDM = true;
        }
      } finally {
        await lock.unlock();
      }

      if (ctx.userSocial.isBlockedBot) {
        ctx.userSocial.isBlockedBot = false;
        await this.userService.saveUserSocial(ctx.userSocial);
      }

      if (ctx.user?.isBanned) {
        return ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Common_Banned));
      }

      try {
        await next();
      } finally {
        if (ctx.userSocial) {
          await this.userService.saveUserSocial(ctx.userSocial);
        }
      }
    };
  }
}
