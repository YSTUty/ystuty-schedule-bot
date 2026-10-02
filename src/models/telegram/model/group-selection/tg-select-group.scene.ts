import { Ctx, Hears, Wizard, WizardStep } from 'nestjs-telega';

import { xs } from '@my-common';
import { Action } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { ICbQOrMsg, IContext, IStepContext } from '@my-interfaces/telegram';

// import { UserService } from '../../user/user.service';
import { ScheduleService } from '../../../schedule/schedule.service';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../../telegram.constants';
import { TelegramService } from '../../telegram.service';
import { TgScheduleKeyboardFactory } from '../schedule/tg-schedule-keyboard.factory';

import { TgGroupPicker } from './tg-group-picker';
import { TgGroupSelectionKeyboardFactory } from './tg-group-selection-keyboard.factory';

@Wizard(SELECT_GROUP_SCENE)
export class TgSelectGroupScene extends BaseScene {
  constructor(
    private readonly baseKeyboardFactory: TelegramKeyboardFactory,
    private readonly keyboardFactory: TgGroupSelectionKeyboardFactory,
    private readonly scheduleKeyboardFactory: TgScheduleKeyboardFactory,
    private readonly scheduleService: ScheduleService,
    private readonly telegramService: TelegramService,
    private readonly groupPicker: TgGroupPicker,
    // private readonly userService: UserService,
  ) {
    super();
  }

  async onСancel(ctx: IContext) {
    const msg = ctx.i18n.t(LocalePhrase.Common_Canceled);
    const keyboard = this.baseKeyboardFactory.getStart(ctx);
    if (ctx.updateType === 'callback_query') {
      await ctx.tryAnswerCbQuery(msg);
      await ctx.deleteMessage();
    } else {
      await ctx.replyWithHTML(msg, keyboard);
    }
  }

  @WizardStep(1)
  @Hears(/.+/)
  @Action(/.+/)
  async step1(
    @Ctx()
    ctx: IStepContext<{
      firstTime?: boolean;
      groupName?: string;
      /** Не редактирует сообщение, из которого был открыт сценарий. */
      forceNewMessage?: boolean;
    }>,
  ) {
    const {
      scene: { state },
      userSocial,
    } = ctx;
    let { groupName } = state;

    // if (!ctx.chat) {
    //     return;
    // }

    // Bad feature for skip button actions
    if (
      (ctx?.message &&
        'text' in ctx.message &&
        ctx.message.text ===
          ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups)) ||
      (ctx?.callbackQuery &&
        'data' in ctx.callbackQuery &&
        ctx.callbackQuery.data === 'pager:inst-list')
    ) {
      await ctx.scene.leave();
      await this.renderInstitutes(ctx as unknown as ICbQOrMsg);
      return;
    }

    const isConv = ctx.chat && ctx.chat.type !== 'private';

    const firstTime = state.firstTime !== false;
    state.firstTime = false;

    if (ctx?.message && 'text' in ctx.message && !firstTime) {
      groupName = ctx.message.text;
    }

    if (firstTime && !groupName) {
      const content = ctx.i18n.t(
        LocalePhrase.Page_SelectGroup_EnterNameWithExample,
        {
          randomGroupName:
            ctx.user?.groupName || this.scheduleService.randomGroupName,
          randomGroupName2: this.scheduleService.randomGroupName,
        },
      );
      const currentGroupName = isConv
        ? ctx.conversation?.groupName
        : userSocial.groupName;
      const prompt = [
        ...(currentGroupName
          ? [
              ctx.i18n.t(LocalePhrase.Page_SelectGroup_Current, {
                groupName: currentGroupName,
              }),
            ]
          : []),
        content,
      ].join('\n\n');
      if (ctx.callbackQuery && !state.forceNewMessage) {
        const keyboard = this.keyboardFactory.getSelectGroupPrompt(ctx, true);
        await ctx.editMessageText(prompt, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } else {
        const keyboard = this.keyboardFactory.getSelectGroupPrompt(ctx, false);
        await ctx.replyWithHTML(prompt, keyboard);
      }
      return;
    }

    // Право на inline callback проверено до входа в сцену. Для текста в
    // беседе по-прежнему требуется явное обращение к боту.
    if (ctx.isUnaddressedGroupMessage()) {
      return;
    }

    if (groupName === '0') {
      if (isConv) {
        if (ctx.conversation) {
          ctx.conversation.groupName = null;
        }
      } else {
        userSocial.groupName = null;
        await this.syncPrivateChatCommands(ctx);
      }

      const keyboard = this.baseKeyboardFactory.getStart(ctx);
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_Reset),
        keyboard,
      );
      await ctx.scene.leave();
      return;
    }

    const selectedGroupName = this.scheduleService.resolveGroupName(groupName);
    if (selectedGroupName) {
      if (isConv) {
        if (ctx.conversation) {
          ctx.conversation.groupName = selectedGroupName;
        }
      } else {
        userSocial.groupName = selectedGroupName;
        await this.syncPrivateChatCommands(ctx);
        // await this.userService.saveUserSocial(ctx.userSocial);
      }

      const keyboard = this.scheduleKeyboardFactory.getScheduleInline(ctx, {
        type: 'group',
        id: selectedGroupName,
      });
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_Selected, {
          selectedGroupName,
        }),
        keyboard,
      );
      if (ctx.chat?.type === 'private') {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_KeyboardUpdated),
          this.baseKeyboardFactory.getStart(ctx),
        );
      }
      await ctx.scene.leave();
      return;
    }

    const keyboard = this.keyboardFactory.getSelectGroupPrompt(ctx, false);
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
      keyboard,
    );
  }

  /** Обновляет меню сразу после изменения выбранной группы в ЛС. */
  private async syncPrivateChatCommands(ctx: IStepContext) {
    if (ctx.chat?.type !== 'private') return;

    await this.telegramService.syncPrivateChatCommands({
      chatId: ctx.chat.id,
      isAuthorized: !!ctx.user,
      isAdmin: this.telegramService.isAdmin(ctx.from.id, ctx.user?.role),
      hasGroup: !!ctx.userSocial.groupName,
      teacherId: ctx.session.teacherId,
    });
  }

  /** Открывает обычный список институтов без зависимости сцены от update-handler. */
  private async renderInstitutes(ctx: ICbQOrMsg) {
    const { text, keyboard } = this.groupPicker.renderInstitutes(
      ctx,
      1,
      {
        prefix: 'pager:glist:',
        pagerName: 'inst-list-26',
        onItem: (instituteHash) => instituteHash,
        additionalButtons: [[this.keyboardFactory.getAllGroupsListButton(ctx)]],
        formatText: ({ currentPage, totalPages }) => xs`
          <b>Список институтов</b>
          <code>---☼ (${currentPage}/${totalPages}) ☼---</code>
        `,
      },
      26,
    );

    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      try {
        await ctx.editMessageText(text, { ...keyboard, parse_mode: 'HTML' });
      } catch {}
      return;
    }

    await ctx.replyWithHTML(text, keyboard);
  }
}
