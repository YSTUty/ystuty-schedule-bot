import { Action, Ctx, Hears, Wizard, WizardStep } from '@xtcry/nestjs-telegraf';

import { Markup } from 'telegraf';

import { LocalePhrase } from '@my-interfaces';
import { ICbQOrMsg, IContext, IStepContext } from '@my-interfaces/telegram';

import { YSTUtyService } from '../../ystuty/ystuty.service';
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
    private readonly ystutyService: YSTUtyService,
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
    @Ctx() ctx: IStepContext<{ firstTime?: boolean; groupName?: string }>,
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
            ctx.user?.groupName || this.ystutyService.randomGroupName,
          randomGroupName2: this.ystutyService.randomGroupName,
        },
      );
      if (ctx.callbackQuery) {
        // const keyboard = this.keyboardFactory.getCancelInline(ctx);
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
              'pager:inst-list',
            ),
          ],
          [
            Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_Cancel),
              LocalePhrase.Button_Cancel,
            ),
          ],
        ]);
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } else {
        // const keyboard = this.keyboardFactory.getCancel(ctx);
        const keyboard = Markup.keyboard([
          [ctx.i18n.t(LocalePhrase.Button_Cancel)],
          [ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups)],
        ]).resize();
        await ctx.replyWithHTML(content, keyboard);
      }
      return;
    }

    if ((isConv && !ctx.state.appeal) || false /* !ctx.message */) {
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
      (this.ystutyService.getGroupByName(groupName) ||
        this.ystutyService.parseGroupName(groupName));
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
      [ctx.i18n.t(LocalePhrase.Button_Cancel)],
      [ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups)],
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
