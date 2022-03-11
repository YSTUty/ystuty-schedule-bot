import { Scene, AddStep, Ctx, SceneLeave } from 'nestjs-vk';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { YSTUtyService } from '../../ystuty/ystuty.service';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../vk.constants';

@Scene(SELECT_GROUP_SCENE)
export class SelectGroupScene {
    constructor(
        private readonly ystutyService: YSTUtyService,
        private readonly keyboardFactory: VKKeyboardFactory,
    ) {}

    @AddStep()
    step1(@Ctx() ctx: IStepContext) {
        const {
            isChat,
            scene: { state },
        } = ctx;
        let { groupName } = state;

        const session = !isChat ? ctx.session : ctx.sessionConversation;

        if (!ctx.scene.step.firstTime) {
            groupName = ctx.text;
        }

        if (ctx.scene.step.firstTime && !groupName) {
            const keyboard = this.keyboardFactory
                .getCancel(ctx)
                .inline(this.keyboardFactory.needInline(ctx));
            ctx.send(
                ctx.i18n.t(LocalePhrase.Page_SelectGroup_EnterNameWithExample, {
                    randomGroupName: this.ystutyService.randomGroupName,
                    randomGroupName2: this.ystutyService.randomGroupName,
                }),
                { keyboard },
            );
            return;
        }

        if (isChat && !ctx.state.appeal) {
            return;
        }

        if (groupName === '0') {
            session.selectedGroupName = undefined;

            const keyboard = this.keyboardFactory
                .getStart(ctx)
                .inline(this.keyboardFactory.needInline(ctx));
            ctx.send(ctx.i18n.t(LocalePhrase.Page_SelectGroup_Reset), {
                keyboard,
            });
            return ctx.scene.leave();
        }

        const selectedGroupName = this.ystutyService.getGroupByName(groupName);
        if (selectedGroupName) {
            session.selectedGroupName = selectedGroupName;

            const keyboard = this.keyboardFactory
                .getStart(ctx)
                .inline(this.keyboardFactory.needInline(ctx));
            ctx.send(
                ctx.i18n.t(LocalePhrase.Page_SelectGroup_Selected, {
                    selectedGroupName,
                }),
                { keyboard },
            );
            return ctx.scene.leave();
        }

        const keyboard = this.keyboardFactory
            .getCancel(ctx)
            .inline(this.keyboardFactory.needInline(ctx));
        return ctx.send(
            ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
            { keyboard },
        );
    }

    @SceneLeave()
    onSceneLeave(@Ctx() ctx: IStepContext) {
        // const keyboard = this.keyboardFactory
        //     .getClose(ctx)
        //     .inline(this.keyboardFactory.onlyInline(ctx));
        // ctx.send(ctx.i18n.t('Done.'), { keyboard });
    }
}
