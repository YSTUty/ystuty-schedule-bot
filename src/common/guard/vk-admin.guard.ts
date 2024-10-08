import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { VkException, VkExecutionContext } from 'nestjs-vk';

import { SOCIAL_VK_ADMIN_IDS } from '@my-environment';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';
import { UserRole } from '@my-common';

@Injectable()
export class VkAdminGuard implements CanActivate {
  constructor(replyRejectMessage?: boolean);
  constructor(rejectMessage: string);
  constructor(private input: boolean | string = true) {}

  canActivate(context: ExecutionContext) {
    const eCtx = VkExecutionContext.create(context);
    const ctx = eCtx.getContext<IContext>();

    if (
      !SOCIAL_VK_ADMIN_IDS.includes(
        ctx.senderId || ctx.peerId,
      ) && ctx.user?.role !== UserRole.ADMIN
    ) {
      if (this.input) {
        if (typeof this.input === 'string') {
          if (ctx.eventPayload && ctx.answer) {
            ctx.answer({
              type: 'show_snackbar',
              text: this.input,
            });
          } else {
            ctx.reply && ctx.reply(this.input).catch();
          }
        } else if (this.input === true) {
          throw new VkException(LocalePhrase.Common_NoAccess);
        }
      }
      // Выдаст ошибку `ForbiddenException`
      return false;
    }
    return true;
  }
}
