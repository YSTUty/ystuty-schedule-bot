import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Command, Ctx, Hears, Next, On, Start, Update } from 'nestjs-telega';

import type { Update as TgUpdate } from 'telegraf-hardened/types';

import { TelegrafExceptionFilter, TelegramAdminGuard, xs } from '@my-common';
import { Action, TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import {
  ICallbackQueryContext,
  ICbQOrMsg,
  IContext,
  IMessageContext,
} from '@my-interfaces/telegram';

import { ScheduleService } from '../../schedule/schedule.service';
import { UserService } from '../../user/user.service';
import { TgGroupSelectionKeyboardFactory } from '../model/group-selection/tg-group-selection-keyboard.factory';
import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../telegram.constants';
import { TelegramService } from '../telegram.service';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class MainUpdate {
  private readonly logger = new Logger(MainUpdate.name);

  constructor(
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly groupSelectionKeyboardFactory: TgGroupSelectionKeyboardFactory,
    private readonly scheduleService: ScheduleService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  @Command('admin')
  @UseGuards(new TelegramAdminGuard(true))
  async onAdmin(@Ctx() ctx: IMessageContext) {
    await ctx.reply('YOUARE ADMIN');
    await ctx.react('👾');
  }

  @On('message_reaction')
  @UseGuards(new TelegramAdminGuard(true))
  async onMessageReaction(@Ctx() ctx: IMessageContext) {
    await ctx.reply(
      `Reaction received: ${JSON.stringify(ctx.reactions.toArray())}`,
    );
  }

  @Command('broke')
  async onBroke() {
    throw new Error('Whoops');
  }

  @Command('invite')
  async onInvite(@Ctx() ctx: IMessageContext) {
    await ctx.replyWithHTML('Пригласить бота в группу:', {
      ...this.keyboardFactory.getInviteToChat(ctx),
    });
  }

  @Action(/nope(:(?<text>.*))?/)
  async onNopeAction(@Ctx() ctx: ICallbackQueryContext) {
    const text = ctx.match!.groups!.text;
    await ctx.tryAnswerCbQuery(text);
  }

  @Action(/sendmsg:callback/)
  async onCallbackFromAdminSendMsg(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.editMessageReplyMarkup(
      this.keyboardFactory.getClear().reply_markup,
    );
    await ctx.tryAnswerCbQuery('✅');
    await this.telegramService.notifyAdmin(
      `<b>[User clicked]</b> chat: [${ctx.chat!.id}]; from: [${
        ctx.from.id
      }];  (${ctx.from.first_name} ${ctx.from.last_name}); @${
        ctx.from.username || '-'
      };\nMSG:\n<code>${
        'text' in ctx.callbackQuery.message!
          ? ctx.callbackQuery.message.text.slice(0, 500)
          : JSON.stringify(ctx.callbackQuery.message)
      }</code>`,
    );
  }

  @TgHearsLocale(LocalePhrase.Button_Cancel)
  @TgHearsLocale(LocalePhrase.RegExp_Start)
  @Start()
  async hearStart(@Ctx() ctx: IMessageContext) {
    if (ctx.chat.type !== 'private' && !ctx.state.appeal) {
      return;
    }

    if (ctx.chat.type === 'private') {
      await this.telegramService.syncPrivateChatCommands({
        chatId: ctx.chat.id,
        isAuthorized: !!ctx.user,
        isAdmin: this.telegramService.isAdmin(ctx.from.id, ctx.user?.role),
        hasGroup: !!ctx.userSocial.groupName,
        teacherId: ctx.session.teacherId,
      });
    }

    if ('text' in ctx.message) {
      const [, ...params] = ctx.message.text.split(' ');
      if (params.length > 0) {
        switch (params[0].replace(/--/g, '.')) {
          case LocalePhrase.Button_SelectGroup: {
            await ctx.scene.enter(SELECT_GROUP_SCENE);
            return;
          }
        }
      }
    }

    const msgPayload = ctx.payload?.trim().split('_');
    if (msgPayload?.length > 1) {
      if (msgPayload[0] === 'g') {
        const groupNameTest = msgPayload.slice(1).join('_');
        const groupName =
          this.scheduleService.parseGroupName(groupNameTest) ||
          this.scheduleService.parseGroupName(
            Buffer.from(groupNameTest, 'base64').toString(),
          );

        if (groupName) {
          await ctx.scene.enter(SELECT_GROUP_SCENE, { groupName });
        }
      }
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);

    if (ctx.chat.type === 'private') {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_WelcomeFeatures),
        this.keyboardFactory.getWelcomeFeatures(ctx),
      );
    }

    if (
      ctx.chat.type === 'private' &&
      (!ctx.userSocial.groupName || !ctx.user)
    ) {
      const keyboard = !ctx.user
        ? this.keyboardFactory.getAuth(
            ctx,
            true,
            true,
            !ctx.userSocial.groupName,
            false,
          )
        : this.groupSelectionKeyboardFactory.getSelectGroupInline(ctx);
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_InitBot), keyboard);
    }
  }

  // /** Отвечает на /cancel, когда пользователь не находится в wizard-сцене. */
  // @Command('cancel')
  // async onCancel(@Ctx() ctx: IMessageContext) {
  //   if (ctx.scene.current) return;
  //   await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Common_Canceled));
  // }

  @TgHearsLocale(LocalePhrase.Button_Profile)
  @Action(LocalePhrase.Button_Profile)
  @Command('profile')
  async onProfile(@Ctx() ctx: ICbQOrMsg) {
    const { user = null } = ctx;
    await ctx.tryAnswerCbQuery();
    if (!user /* || user.isRewoked */) {
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Auth_NeedAuth));
      return ctx.scene.enter(AUTH_SCENE);
    }

    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Profile_Info, { user }),
    );
  }

  @Command('unauth')
  async onUnAuth(@Ctx() ctx: ICbQOrMsg) {
    const { user = null } = ctx;
    await ctx.tryAnswerCbQuery();
    if (!user /*  || user.isRewoked */) {
      await ctx.replyWithHTML('No account');
      return;
    }

    ctx.noUpdateUserSocial = true;
    await this.userService.unlinkUser(ctx.userSocial);

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.replyWithHTML('Done', keyboard);
  }

  @Command('update_profile')
  async onUpdateProfile(@Ctx() ctx: ICbQOrMsg) {
    const { user = null, userSocial } = ctx;
    await ctx.tryAnswerCbQuery();
    if (!user || user.isRewoked) {
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Auth_NeedAuth));
      return ctx.scene.enter(AUTH_SCENE);
    }

    const res = await this.userService.updateUserData(userSocial);
    if (!res) {
      ctx.replyWithHTML('Error');
      return;
    }
    if (typeof res === 'string') {
      await ctx.replyWithHTML(`<b>Fail:</b> ${res}`);
      return;
    }

    await ctx.replyWithHTML(xs`
      Updated:
      <code>${JSON.stringify(res, null, 2)}</code>
    `);
  }

  @Hears(['/auth', 'login', 'войти'])
  @TgHearsLocale([
    LocalePhrase.Button_AuthLink,
    LocalePhrase.Button_AuthLink_SocialConnect,
  ])
  @Action([
    LocalePhrase.Button_AuthLink,
    LocalePhrase.Button_AuthLink_SocialConnect,
  ])
  async onAuth(@Ctx() ctx: ICbQOrMsg) {
    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText('Auth...');
      // await ctx.editMessageReplyMarkup(
      //   this.keyboardFactory.getClear().reply_markup,
      // );
      // await ctx.tryAnswerCbQuery('Enter');
    }
    await ctx.scene.enter(AUTH_SCENE);
  }

  @TgHearsLocale(LocalePhrase.RegExp_Help)
  @Action('help:open')
  async hearHelp(@Ctx() ctx: ICbQOrMsg) {
    if (!ctx.chat || (ctx.chat.type !== 'private' && !ctx.state.appeal)) {
      return;
    }

    if (ctx.updateType === 'callback_query') {
      await ctx.tryAnswerCbQuery();
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Help), keyboard);
  }

  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: IContext<{}, TgUpdate.MyChatMemberUpdate>) {
    const { chat, new_chat_member } = ctx.myChatMember;
    const { status, user } = new_chat_member;
    const oldStatus = ctx.myChatMember.old_chat_member?.status ?? 'unknown';

    // * Skip check other user|bot
    if (user.id !== ctx.botInfo.id) {
      return;
    }

    if (chat.type === 'private') {
      // User blocked/unblocked this bot
      ctx.userSocial.isBlockedBot =
        status === 'kicked' /* || status === 'left' */;
      return;
    }

    const { title, type } = chat;
    if (!ctx.conversation) {
      this.logger.error(`Empty conversation in ctx`);
      return;
    }

    const previousIsLeaved = ctx.conversation.isLeaved;
    ctx.conversation.invitedByUserSocialId = ctx.userSocial.id;
    ctx.conversation.chatStatus = status;
    ctx.conversation.title = title;
    ctx.conversation.chatType = type;
    ctx.conversation.isLeaved = status === 'kicked' || status === 'left';
    if (
      oldStatus !== status ||
      previousIsLeaved !== ctx.conversation.isLeaved
    ) {
      this.logger.debug(
        `[TG][conversation] my_chat_member chat=${chat.id} title="${title}" status=${oldStatus}->${status} isLeaved=${previousIsLeaved}->${ctx.conversation.isLeaved}`,
      );
    }

    const activeStatuses: (typeof status)[] = [
      'creator',
      'administrator',
      'member',
      'restricted',
    ];
    const hasJoinedChat =
      activeStatuses.includes(status) && !activeStatuses.includes(oldStatus);
    if (hasJoinedChat) {
      if (chat.type !== 'channel') {
        const keyboard = this.keyboardFactory.getStart(ctx);
        await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);
      }

      await this.telegramService.parseChatTitle(
        ctx,
        title,
        chat.type !== 'channel',
      );

      if (chat.type !== 'channel' && !ctx.conversation.groupName) {
        const keyboard =
          this.groupSelectionKeyboardFactory.getSelectGroupInline(ctx);
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_InitBot),
          keyboard,
        );
      }
    }
  }

  @On('new_chat_title')
  async onNewChatTitle(@Ctx() ctx: IMessageContext) {
    if ('new_chat_title' in ctx.message) {
      await this.telegramService.parseChatTitle(
        ctx,
        ctx.message.new_chat_title,
      );
    }
  }

  @On('inline_query')
  async onInlineQuery(
    @Ctx() _ctx: IContext<{}, TgUpdate.InlineQueryUpdate>,
    @Next() next,
  ) {
    return next();
  }

  @On('chosen_inline_result')
  onChosenInlineResult(
    @Ctx() ctx: IContext<{}, TgUpdate.ChosenInlineResultUpdate>,
  ) {
    this.logger.debug('OnChosenInlineResult', ctx.chosenInlineResult);
  }
}
