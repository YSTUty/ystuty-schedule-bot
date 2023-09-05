import { UseFilters } from '@nestjs/common';
import { Action, Command, Ctx, Next } from '@xtcry/nestjs-telegraf';

import { TelegrafExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IStepContext } from '@my-interfaces/telegram';
import { TgHearsLocale } from '@my-common/decorator/tg';

@UseFilters(TelegrafExceptionFilter)
export class BaseScene {
    protected isCancelable = true;

    async onLeave(_ctx: IContext | IStepContext) {
        // вместо баганой @SceneLeave()
        // ! here session not ediable...
    }
    async leaveScene(@Ctx() ctx: IContext | IStepContext) {
        ctx.scene.current?.leave?.();
        await ctx.scene.leave();
        /* await */ this.onLeave(ctx);
    }

    @Command('exit')
    @Command('cancel')
    @Action('cancel')
    @Action(LocalePhrase.Button_Cancel)
    @TgHearsLocale(LocalePhrase.Button_Cancel)
    __onСancel(@Ctx() ctx: IContext, @Next() next: Function) {
        if (!this.isCancelable) {
            next?.();
            return;
        }

        this.onСancel(ctx, next);
        // ctx.scene.leave();
        this.leaveScene(ctx);
    }

    onСancel(ctx: IContext, next?: Function) {
        const msg = ctx.i18n.t(LocalePhrase.Common_Canceled);
        if (ctx.updateType === 'callback_query') {
            ctx.tryAnswerCbQuery(msg);
            ctx.deleteMessage();
        } else {
            ctx.replyWithHTML(msg);
        }
    }
}
