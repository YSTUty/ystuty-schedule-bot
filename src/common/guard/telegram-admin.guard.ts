import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TelegrafException, TelegrafExecutionContext } from 'nestjs-telega';

import { SOCIAL_TELEGRAM_ADMIN_IDS } from '@my-environment';

import { UserRole } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

@Injectable()
export class TelegramAdminGuard implements CanActivate {
  constructor(replyRejectMessage?: boolean);
  constructor(rejectMessage: string);
  constructor(private input: boolean | string = true) {}

  async canActivate(context: ExecutionContext) {
    const eCtx = TelegrafExecutionContext.create(context);
    const ctx = eCtx.getContext<IContext>();

    if (
      ctx.from &&
      !SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id) &&
      ctx.user?.role !== UserRole.ADMIN
    ) {
      if (this.input) {
        if (typeof this.input === 'string') {
          await ctx.replyWithHTML(this.input);
        } else if (this.input === true) {
          throw new TelegrafException(LocalePhrase.Common_NoAccess);
        }
      }
      return false;
    }

    return true;
  }
}
