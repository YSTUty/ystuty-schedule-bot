import { Ctx, Wizard, WizardStep } from '@xtcry/nestjs-telegraf';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IStepContext } from '@my-interfaces/telegram';

import { YSTUtyService } from '../../ystuty/ystuty.service';
import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../telegram.constants';
import { BaseScene } from '../base.scene';

@Wizard(SELECT_GROUP_SCENE)
export class SelectGroupScene extends BaseScene {
    constructor(
        private readonly ystutyService: YSTUtyService,
        private readonly keyboardFactory: TelegramKeyboardFactory,
    ) {
        super();
    }

    // // @SceneLeave()
    // async onLeave(@Ctx() ctx: IStepContext) {
    //     const keyboard = this.keyboardFactory.getStart(ctx);
    //     ctx.replyWithHTML('Main page', keyboard);
    // }

    onСancel(ctx: IContext) {
        const msg = ctx.i18n.t(LocalePhrase.Common_Canceled);
        const keyboard = this.keyboardFactory.getStart(ctx);
        if (ctx.updateType === 'callback_query') {
            ctx.tryAnswerCbQuery(msg);
            ctx.deleteMessage();
        } else {
            ctx.replyWithHTML(msg, keyboard);
        }
    }

    @WizardStep(1)
    step1(@Ctx() ctx: IStepContext) {
        const {
            scene: { state },
        } = ctx;
        let { groupName } = state;

        if (!('text' in ctx.message)) {
            return;
        }

        const firstTime = state.firstTime !== false;
        state.firstTime = false;

        const isChat = ctx.chat.type !== 'private';
        const session = !isChat ? ctx.session : ctx.sessionConversation;

        if (!firstTime) {
            groupName = ctx.message.text;
        }

        if (firstTime && !groupName) {
            const keyboard = this.keyboardFactory.getCancel(ctx);
            ctx.replyWithHTML(
                ctx.i18n.t(LocalePhrase.Page_SelectGroup_EnterNameWithExample, {
                    randomGroupName: this.ystutyService.randomGroupName,
                    randomGroupName2: this.ystutyService.randomGroupName,
                }),
                keyboard,
            );
            return;
        }

        if (groupName === '0') {
            session.selectedGroupName = undefined;

            const keyboard = this.keyboardFactory.getStart(ctx);
            ctx.replyWithHTML(
                ctx.i18n.t(LocalePhrase.Page_SelectGroup_Reset),
                keyboard,
            );
            ctx.scene.leave();
            return;
        }

        const selectedGroupName = this.ystutyService.getGroupByName(groupName);
        if (selectedGroupName) {
            session.selectedGroupName = selectedGroupName;

            const keyboard = this.keyboardFactory.getStart(ctx);
            ctx.replyWithHTML(
                ctx.i18n.t(LocalePhrase.Page_SelectGroup_Selected, {
                    selectedGroupName,
                }),
                keyboard,
            );
            ctx.scene.leave();
            return;
        }

        const keyboard = this.keyboardFactory.getCancel(ctx);
        ctx.replyWithHTML(
            ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
            keyboard,
        );
    }
}
