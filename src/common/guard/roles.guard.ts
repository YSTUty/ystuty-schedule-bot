import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TelegrafContextType,
  TelegrafException,
  TelegrafExecutionContext,
} from 'nestjs-telega';
import { VkContextType, VkException, VkExecutionContext } from 'nestjs-vk';

import * as xEnv from '@my-environment';

import { UserRole } from '@my-common';
import {
  ALLOWED_ROLES_KEY,
  ALLOWED_ROLES_SILENT_KEY,
  IS_ANY_ROLES,
} from '@my-common/decorator';
import {
  TelegrafChatType,
  TG_ALLOWED_CHAT_TYPES_KEY,
} from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { IContext as TgIContext } from '@my-interfaces/telegram';
import { IContext as VkIContext } from '@my-interfaces/vk';

function toArr<T>(arr: T | T[]): T[] {
  return Array.isArray(arr) ? arr : [arr];
}

/**
 * Must be used in conjunction with the `@AllowedRoles` decorator
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<any> {
    const handler = context.getHandler();
    const controller = context.getClass();

    const targets = [handler, controller];
    const isAnyRoles = this.reflector.getAllAndOverride<boolean>(
      IS_ANY_ROLES,
      targets,
    );
    const allowedRoles = this.reflector.getAllAndMerge<UserRole[]>(
      ALLOWED_ROLES_KEY,
      targets,
    );
    const allowedRolesSilent = toArr(
      this.reflector.getAllAndMerge<boolean[]>(
        ALLOWED_ROLES_SILENT_KEY,
        targets,
      ),
    );

    // TODO?: add check chat type for vk
    if (context.getType<TelegrafContextType>() === 'telegraf') {
      const eCtx = TelegrafExecutionContext.create(context);
      const ctx = eCtx.getContext<TgIContext>();

      const allowedChatTypes = this.reflector.getAllAndMerge<
        TelegrafChatType[]
      >(TG_ALLOWED_CHAT_TYPES_KEY, [handler, controller]);

      if (
        ctx.chat?.type &&
        allowedChatTypes.length > 0 &&
        !allowedChatTypes.includes(ctx.chat.type) &&
        !allowedChatTypes.includes('any')
      ) {
        throw new TelegrafException('SKIP');
      }
    }

    if (!allowedRoles.length || isAnyRoles) {
      return true;
    }

    if (context.getType<VkContextType>() === 'vk-io') {
      const eCtx = VkExecutionContext.create(context);
      const ctx = eCtx.getContext<VkIContext>();
      if (
        // !xEnv.SOCIAL_VK_ADMIN_IDS.includes(ctx.from?.id) &&
        !ctx.state.user ||
        !allowedRoles.includes(ctx.state.user.role)
      ) {
        if (allowedRolesSilent.some((e) => e === true)) {
          throw new VkException('SKIP_FULL');
        }
        throw new VkException(LocalePhrase.Common_NoAccess);
      }
      return true;
    } else if (context.getType<TelegrafContextType>() === 'telegraf') {
      const eCtx = TelegrafExecutionContext.create(context);
      const ctx = eCtx.getContext<TgIContext>();
      if (
        !ctx.from ||
        (!xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id) &&
          (!ctx.user || !allowedRoles.includes(ctx.user.role)))
      ) {
        if (allowedRolesSilent.some((e) => e === true)) {
          throw new TelegrafException('SKIP_FULL');
        }
        throw new TelegrafException(LocalePhrase.Common_NoAccess);
      }
      return true;
    }

    throw new ForbiddenException(
      'Could not authenticate with token or user does not have permissions',
    );
  }
}
