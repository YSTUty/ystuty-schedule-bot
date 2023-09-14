import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TelegrafException,
  TelegrafExecutionContext,
} from '@xtcry/nestjs-telegraf';
import { VkException, VkExecutionContext } from 'nestjs-vk';

import * as xEnv from '@my-environment';
import { UserRole } from '@my-common';
import { ALLOWED_ROLES_KEY, IS_ANY_ROLES } from '@my-common/decorator';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

/**
 * Must be used in conjunction with the `@AllowedRoles` decorator
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<any> {
    const handler = context.getHandler();
    const controller = context.getClass();
    const isAnyRoles = this.reflector.getAllAndOverride<boolean>(IS_ANY_ROLES, [
      handler,
      controller,
    ]);
    const allowedRoles = this.reflector.getAllAndMerge<UserRole[]>(
      ALLOWED_ROLES_KEY,
      [handler, controller],
    );

    if (!allowedRoles.length || isAnyRoles) {
      return true;
    }

    if (context.getType<string>() === 'vk-io') {
      const eCtx = VkExecutionContext.create(context);
      const ctx = eCtx.getContext<IContext>();
      if (
        // !xEnv.SOCIAL_VK_ADMIN_IDS.includes(ctx.from?.id) &&
        !allowedRoles.includes(ctx.user?.role)
      ) {
        throw new VkException(LocalePhrase.Common_NoAccess);
      }
      return true;
    } else if (context.getType<string>() === 'telegraf') {
      const eCtx = TelegrafExecutionContext.create(context);
      const ctx = eCtx.getContext<IContext>();
      if (
        !xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from?.id) &&
        !allowedRoles.includes(ctx.user?.role)
      ) {
        throw new TelegrafException(LocalePhrase.Common_NoAccess);
      }
      return true;
    }

    throw new ForbiddenException(
      'Could not authenticate with token or user does not have permissions',
    );
  }
}
