import { Action, Ctx, Hears, Wizard, WizardStep } from 'nestjs-telega';

import { Markup } from 'telegraf-hardened';

import { LocalePhrase } from '@my-interfaces';
import { ICbQOrMsg, IContext, IStepContext } from '@my-interfaces/telegram';

import { ScheduleService } from '../../schedule/schedule.service';
import { TelegramButtons } from '../telegram-buttons.util';
// import { UserService } from '../../user/user.service';
import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../telegram.constants';
import { TelegramService } from '../telegram.service';
import { MainUpdate } from '../update/main.update';

import { BaseScene } from './base.scene';

@Wizard(SELECT_GROUP_SCENE)
export class SelectGroupScene extends BaseScene {
  constructor(
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly scheduleService: ScheduleService,
    private readonly telegramService: TelegramService,
    // private readonly userService: UserService,
    private readonly mainUpdate: MainUpdate,
  ) {
    super();
  }

  async onСancel(ctx: IContext) {
    const msg = ctx.i18n.t(LocalePhrase.Common_Canceled);
    const keyboard = this.keyboardFactory.getStart(ctx);
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
      // next();
      this.mainUpdate.onInstitutesList(ctx as unknown as ICbQOrMsg);
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
        // const keyboard = this.keyboardFactory.getCancelInline(ctx);
        const keyboard = Markup.inlineKeyboard([
          [
            TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
              'pager:inst-list',
              { style: 'primary' },
            ),
          ],
          [
            TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_Cancel),
              LocalePhrase.Button_Cancel,
              { style: 'danger' },
            ),
          ],
        ]);
        await ctx.editMessageText(prompt, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } else {
        // const keyboard = this.keyboardFactory.getCancel(ctx);
        const keyboard = Markup.keyboard([
          [
            TelegramButtons.text(ctx.i18n.t(LocalePhrase.Button_Cancel), {
              style: 'danger',
            }),
          ],
          [
            TelegramButtons.text(
              ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
              { style: 'primary' },
            ),
          ],
        ]).resize();
        await ctx.replyWithHTML(prompt, keyboard);
      }
      return;
    }

    // Право на inline callback проверено до входа в сцену. Для текста в
    // беседе по-прежнему требуется явное обращение к боту.
    if (isConv && !ctx.callbackQuery && !ctx.state.appeal) {
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

      const keyboard = this.keyboardFactory.getStart(ctx);
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_Reset),
        keyboard,
      );
      await ctx.scene.leave();
      return;
    }

    const selectedGroupName =
      groupName &&
      (this.scheduleService.getGroupByName(groupName) ||
        this.scheduleService.parseGroupName(groupName));
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

      const keyboard = this.keyboardFactory.getStart(ctx);
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_Selected, {
          selectedGroupName,
        }),
        keyboard,
      );
      await ctx.scene.leave();
      return;
    }

    // const keyboard = this.keyboardFactory.getCancel(ctx);
    const keyboard = Markup.keyboard([
      [
        TelegramButtons.text(ctx.i18n.t(LocalePhrase.Button_Cancel), {
          style: 'danger',
        }),
      ],
      [
        TelegramButtons.text(
          ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
          { style: 'primary' },
        ),
      ],
    ]).resize();
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
}
