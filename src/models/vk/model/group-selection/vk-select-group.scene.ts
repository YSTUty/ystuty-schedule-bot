import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene, SceneLeave } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { ScheduleService } from '../../../schedule/schedule.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../../vk.constants';
import { VkScheduleKeyboardFactory } from '../schedule/vk-schedule-keyboard.factory';

import { VkGroupPicker } from './vk-group-picker';
import { VkGroupSelectionKeyboardFactory } from './vk-group-selection-keyboard.factory';

@Scene(SELECT_GROUP_SCENE)
@UseFilters(VkExceptionFilter)
export class VkSelectGroupScene {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly baseKeyboardFactory: VKKeyboardFactory,
    private readonly keyboardFactory: VkGroupSelectionKeyboardFactory,
    private readonly scheduleKeyboardFactory: VkScheduleKeyboardFactory,
    private readonly groupPicker: VkGroupPicker,
  ) {}

  @AddStep()
  async step1(
    @Ctx()
    ctx: IStepContext<{ groupName: string; forceNewMessage?: boolean }>,
  ) {
    const {
      isChat: isConv,
      scene: { state },
    } = ctx;
    let { groupName } = state;

    if (
      'eventPayload' in ctx &&
      ctx.eventPayload?.groupAction === 'institutes'
    ) {
      await ctx.scene.leave();
      await this.renderInstitutes(ctx);
      return;
    }

    const isMessageEvent = ctx.is(['message_event']);
    if (ctx.scene.step.firstTime && !groupName) {
      const keyboard = this.keyboardFactory.getSelectGroupScene(ctx).inline();
      const currentGroupName = isConv
        ? ctx.state.conversation?.groupName
        : ctx.state.userSocial.groupName;
      await ctx.send(
        [
          ...(currentGroupName
            ? [
                ctx.i18n.t(LocalePhrase.Page_SelectGroup_Current, {
                  groupName: currentGroupName,
                }),
              ]
            : []),
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_EnterNameWithExample, {
            randomGroupName:
              ctx.state.user?.groupName || this.scheduleService.randomGroupName,
            randomGroupName2: this.scheduleService.randomGroupName,
          }),
        ].join('\n\n'),
        { keyboard },
      );
      return;
    }

    // Чужой callback не содержит введённого названия группы.
    if (isMessageEvent) {
      const selectedGroupName =
        'eventPayload' in ctx &&
        ctx.eventPayload?.groupAction === 'select' &&
        typeof ctx.eventPayload.groupName === 'string'
          ? ctx.eventPayload.groupName
          : undefined;
      if (!selectedGroupName) {
        return;
      }
      groupName = selectedGroupName;
    } else if (!ctx.scene.step.firstTime) {
      groupName = ctx.text;
    }

    // Inline callback — это явное действие. Проверка обращения относится
    // только к обычному тексту, полученному в беседе.
    if (
      ctx.isUnaddressedGroupMessage() ||
      !ctx.is(['message', 'message_event'])
    ) {
      return;
    }

    if (groupName === '0') {
      if (isConv) {
        if (ctx.state.conversation) {
          ctx.state.conversation.groupName = null;
        }
      } else {
        ctx.state.userSocial.groupName = null;
      }

      const keyboard = this.baseKeyboardFactory
        .getStart(ctx)
        .inline(this.baseKeyboardFactory.needInline(ctx));
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_SelectGroup_Reset), {
        keyboard,
      });
      return ctx.scene.leave();
    }

    const selectedGroupName = this.scheduleService.resolveGroupName(groupName);
    if (selectedGroupName) {
      if (isConv) {
        if (ctx.state.conversation) {
          ctx.state.conversation.groupName = selectedGroupName;
        }
      } else {
        ctx.state.userSocial.groupName = selectedGroupName;
      }

      const keyboard = this.scheduleKeyboardFactory
        .getSchedule(ctx, { type: 'group', id: selectedGroupName })
        .inline();
      if (ctx.isMessageEventContext() && !state.forceNewMessage) {
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
      if (ctx.isDM) {
        await ctx.send(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_KeyboardUpdated),
          { keyboard: this.baseKeyboardFactory.getStart(ctx) },
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
  onSceneLeave(@Ctx() _ctx: IStepContext) {
    // const keyboard = this.keyboardFactory
    //     .getClose(ctx)
    //     .inline(this.keyboardFactory.onlyInline(ctx));
    // ctx.send(ctx.i18n.t('Done.'), { keyboard });
  }

  /** Открывает список институтов без вызова update-handler из активной сцены. */
  private async renderInstitutes(ctx: IStepContext) {
    const { text, keyboard } = this.groupPicker.renderInstitutes(
      ctx,
      1,
      {
        onItem: (instituteHash) => ({
          groupAction: 'groups',
          instituteHash,
        }),
        onPage: (_instituteHash, page) => ({
          groupAction: 'institutes',
          page,
        }),
        pagerMode: 'adaptive',
      },
      5,
    );
    const inlineKeyboard = keyboard.inline();

    if (ctx.isMessageEventContext()) {
      await ctx.editMessage({ message: text, keyboard: inlineKeyboard });
      return;
    }

    await ctx.send(text, { keyboard: inlineKeyboard });
  }
}
