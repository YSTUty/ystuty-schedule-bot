import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
    TelegrafExecutionContext,
    TelegrafException,
} from '@xtcry/nestjs-telegraf';
import { SOCIAL_TELEGRAM_ADMIN_IDS } from '@my-environment';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

@Injectable()
export class TelegramAdminGuard implements CanActivate {
    constructor(replyRejectMessage?: boolean);
    constructor(rejectMessage: string);
    constructor(private input: boolean | string = true) {}

    canActivate(context: ExecutionContext) {
        const eCtx = TelegrafExecutionContext.create(context);
        const ctx = eCtx.getContext<IContext>();

        if (
            !SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id)
            // && ctx.user?.role !== UserRole.ADMIN
        ) {
            if (this.input) {
                if (typeof this.input === 'string') {
                    ctx.replyWithHTML(this.input);
                } else if (this.input === true) {
                    throw new TelegrafException(LocalePhrase.Common_NoAccess);
                }
            }
            return false;
        }

        return true;
    }
}
