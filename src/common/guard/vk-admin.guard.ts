import {
  CanActivate,
  ExecutionContext,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { VkException, VkExecutionContext } from 'nestjs-vk';

import { SOCIAL_VK_ADMIN_IDS } from '@my-environment';

import { UserRole } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

export function VkAdminGuard(replyRejectMessage?: boolean): Type<CanActivate>;
export function VkAdminGuard(rejectMessage: string): Type<CanActivate>;
export function VkAdminGuard(
  input: boolean | string = true,
): Type<CanActivate> {
  @Injectable()
  class VkAdminGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext) {
      const eCtx = VkExecutionContext.create(context);
      const ctx = eCtx.getContext<IContext>();

      if (
        !SOCIAL_VK_ADMIN_IDS.includes(ctx.senderId || ctx.peerId) &&
        ctx.state.user?.role !== UserRole.ADMIN
      ) {
        if (input) {
          if (typeof input === 'string') {
            if (ctx.eventPayload && ctx.answer) {
              ctx
                .answer({
                  type: 'show_snackbar',
                  text: input,
                })
                .catch();
            } else {
              if (ctx.reply) {
                ctx.reply(input).catch();
              }
            }
          } else if (input === true) {
            throw new VkException(LocalePhrase.Common_NoAccess);
          }
        }
        // Выдаст ошибку `ForbiddenException`
        return false;
      }
      return true;
    }
  }
  return mixin(VkAdminGuardMixin);
}
