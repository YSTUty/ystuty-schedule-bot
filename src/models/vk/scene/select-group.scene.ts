import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Next, Scene, SceneLeave } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { YSTUtyService } from '../../ystuty/ystuty.service';
import { MainUpdate } from '../update/main.update';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../vk.constants';

@Scene(SELECT_GROUP_SCENE)
@UseFilters(VkExceptionFilter)
export class SelectGroupScene {
  constructor(
    private readonly ystutyService: YSTUtyService,
    private readonly keyboardFactory: VKKeyboardFactory,
    private readonly mainUpdate: MainUpdate,
  ) {}

  @AddStep()
  async step1(@Ctx() ctx: IStepContext<{ groupName: string }>) {
    const {
      isChat,
      scene: { state },
    } = ctx;
    let { groupName } = state;

    if (
      'eventPayload' in ctx &&
      ctx.eventPayload?.groupAction === 'institutes'
    ) {
      await ctx.scene.leave();
      await this.mainUpdate.onInstitutesList(ctx);
      return;
    }

    if (!ctx.scene.step.firstTime) {
      groupName = ctx.text;
    }

    if (ctx.scene.step.firstTime && !groupName) {
      const keyboard = this.keyboardFactory.getSelectGroupScene(ctx).inline();
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_EnterNameWithExample, {
          randomGroupName:
            ctx.state.user?.groupName || this.ystutyService.randomGroupName,
          randomGroupName2: this.ystutyService.randomGroupName,
        }),
        { keyboard },
      );
      return;
    }

    if (
      (isChat && !ctx.state.appeal) ||
      !ctx.is(['message', 'message_event'])
    ) {
      return;
    }

    if (groupName === '0') {
      if (isChat) {
        ctx.sessionConversation.selectedGroupName = undefined;
      } else {
        ctx.state.userSocial.groupName = null;
      }

      const keyboard = this.keyboardFactory
        .getStart(ctx)
        .inline(this.keyboardFactory.needInline(ctx));
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_SelectGroup_Reset), {
        keyboard,
      });
      return ctx.scene.leave();
    }

    const selectedGroupName =
      groupName &&
      (this.ystutyService.getGroupByName(groupName) ||
        this.ystutyService.parseGroupName(groupName));
    if (selectedGroupName) {
      if (isChat) {
        ctx.sessionConversation.selectedGroupName = selectedGroupName;
        if (ctx.state.conversation) {
          ctx.state.conversation.groupName = selectedGroupName;
        }
      } else {
        ctx.state.userSocial.groupName = selectedGroupName;
      }

      const keyboard = this.keyboardFactory
        .getStart(ctx)
        .inline(this.keyboardFactory.needInline(ctx));
      if (ctx.isMessageEventContext()) {
        await ctx.editMessage({
          message: ctx.i18n.t(LocalePhrase.Page_SelectGroup_Selected, {
            selectedGroupName,
          }),
          keyboard,
        });
      } else {
        await ctx.send(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_Selected, {
            selectedGroupName,
          }),
          { keyboard },
        );
      }
      return ctx.scene.leave();
    }

    const keyboard = this.keyboardFactory
      .getSelectGroupScene(ctx)
      // Callback-кнопки VK работают только в inline-клавиатуре, в том числе в ЛС.
      .inline();
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
