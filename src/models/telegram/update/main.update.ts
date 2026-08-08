import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import {
  Action,
  Command,
  Ctx,
  Hears,
  Next,
  On,
  Start,
  Update,
} from '@xtcry/nestjs-telegraf';

import { Markup, TelegramError } from 'telegraf';
import type { Update as TgUpdate } from 'telegraf/types';

import {
  allowerHtmlTags,
  md5,
  patternGroupName,
  teacherListCommandRegExp,
  teacherSearchCommandRegExp,
  TelegrafExceptionFilter,
  TelegramAdminGuard,
  xs,
} from '@my-common';
import { TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import {
  ICallbackQueryContext,
  ICbQOrMsg,
  IContext,
  IMessageContext,
} from '@my-interfaces/telegram';

import { UserService } from '../../user/user.service';
import { TeacherListStateService } from '../../ystuty/teacher-list-state.service';
import { YSTUtyService } from '../../ystuty/ystuty.service';
import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../telegram.constants';
import { TelegramService } from '../telegram.service';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class MainUpdate {
  private readonly logger = new Logger(MainUpdate.name);

  constructor(
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly ystutyService: YSTUtyService,
    private readonly teacherListStateService: TeacherListStateService,
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
  async onBroke(@Ctx() ctx: IMessageContext) {
    throw new Error('Whoops');
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
          this.ystutyService.parseGroupName(groupNameTest) ||
          this.ystutyService.parseGroupName(
            Buffer.from(groupNameTest, 'base64').toString(),
          );

        if (groupName) {
          await ctx.scene.enter(SELECT_GROUP_SCENE, { groupName });
        }
      }
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);

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
        : this.keyboardFactory.getSelectGroupInline(ctx);
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_InitBot), keyboard);
    }
  }

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
  async hearHelp(@Ctx() ctx: IMessageContext) {
    if (ctx.chat.type !== 'private' && !ctx.state.appeal) {
      return;
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Help), keyboard);
  }

  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: IContext<{}, TgUpdate.MyChatMemberUpdate>) {
    const {
      chat,
      new_chat_member: { status, user },
    } = ctx.myChatMember;

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
    this.logger.log(`New chat bot status: "${status}" in "${title}" ${type}`);

    if (!ctx.conversation) {
      this.logger.error(`Empty conversation in ctx`);
      return;
    }

    ctx.conversation.invitedByUserSocialId = ctx.userSocial.id;
    ctx.conversation.chatStatus = status;
    ctx.conversation.title = title;
    ctx.conversation.chatType = type;
    ctx.conversation.isLeaved = status === 'kicked' || status === 'left';

    if (
      status === 'creator' ||
      status === 'administrator' ||
      status === 'member' ||
      status === 'restricted'
    ) {
      if (chat.type !== 'channel') {
        const keyboard = this.keyboardFactory.getStart(ctx);
        await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);
      }

      await this.telegramService.parseChatTitle(
        ctx,
        title,
        chat.type !== 'channel',
      );

      if (
        chat.type !== 'channel' &&
        !ctx.sessionConversation.selectedGroupName &&
        !ctx.conversation.groupName
      ) {
        const keyboard = this.keyboardFactory.getSelectGroupInline(ctx);
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
    @Ctx() ctx: IContext<{}, TgUpdate.InlineQueryUpdate>,
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

  @TgHearsLocale(LocalePhrase.Button_Groups_ListInstAndGroups)
  @Command('groups')
  @Command('institutes')
  @Action(/pager:inst-list(-(?<count>[0-9]+))?(:(?<page>[0-9]+))?/i)
  async onInstitutesList(@Ctx() ctx: ICbQOrMsg) {
    let page: number | null = null;
    let count: number | null = null;

    if (ctx.updateType === 'callback_query') {
      if (ctx.match?.groups) {
        page = Number(ctx.match.groups.page);
        count = Number(ctx.match.groups.count);
      }
    } else if ('text' in ctx.message && !ctx.state.isLocalePhrase) {
      [, page, count] = ctx.message.text.split(' ').map(Number);
    }

    page = page || 1;
    count = count || 26;

    const { items, currentPage, totalPages } =
      this.ystutyService.groupsInstitutesList(page, count);

    const keyboard = this.keyboardFactory.getPagination({
      name: `inst-list-${count}`,
      currentPage,
      totalPages,
      items: items.map((e) => ({
        title: e,
        payload: md5(e),
      })),
      actionPrefix: 'pager:glist:',
      columnizer: true,
    });

    const content = xs`
        <b>Список институтов</b>
        <code>---☼ (${currentPage}/${totalPages}) ☼---</code>
    `;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      await ctx.tryAnswerCbQuery();
    } else {
      await ctx.replyWithHTML(content, keyboard);
    }
  }

  @Command('glist')
  @Action(
    /pager:glist(:(?<instituteNameMD5>[a-f0-9]{32}))?(-(?<count>[0-9]+))?(:(?<page>[0-9]+))?/i,
  )
  async onGroupsList(@Ctx() ctx: ICbQOrMsg) {
    let page: number | null = null;
    let count: number | null = null;
    let instituteNameMD5: string | null = null;

    if (ctx.updateType === 'callback_query') {
      if (ctx.match?.groups) {
        instituteNameMD5 = ctx.match.groups.instituteNameMD5;
        page = Number(ctx.match.groups.page);
        count = Number(ctx.match.groups.count);
      }
    } else if ('text' in ctx.message && !ctx.state.isLocalePhrase) {
      [, page, count] = ctx.message.text.split(' ').map(Number);
    }

    page = page || 1;
    count = count || 26;

    const { items, currentPage, totalPages } = this.ystutyService.groupsList(
      page,
      count,
      instituteNameMD5,
    );

    const keyboard = this.keyboardFactory.getPagination({
      name: `glist${instituteNameMD5 ? `:${instituteNameMD5}` : ''}-${count}`,
      currentPage,
      totalPages,
      items,
      actionPrefix: 'selectGroup:',
      additionalButtons: [
        ...(instituteNameMD5
          ? [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Groups_ChangeInstitute),
                'pager:inst-list',
              ),
            ]
          : []),
      ],
      columnizer: true,
    });

    const instituteName = instituteNameMD5
      ? this.ystutyService.instituteNameByMD5(instituteNameMD5)
      : null;
    const content = xs`
        <b>Список групп${instituteName ? ` <i>(${instituteName})</i>` : ''}</b>
        <code>---☼ (${currentPage}/${totalPages}) ☼---</code>
    `;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      await ctx.tryAnswerCbQuery();
    } else {
      await ctx.replyWithHTML(content, keyboard);
    }
  }

  @Command('tlist')
  @Hears(teacherListCommandRegExp)
  @TgHearsLocale(LocalePhrase.Button_Schedule_Teacher)
  @Action(LocalePhrase.Button_Schedule_Teacher)
  async onTeachersList(@Ctx() ctx: ICbQOrMsg) {
    await this.openTeachersList(ctx, '');
  }

  @Action(/pager:teacher-list:(?<listId>[a-f0-9]{12}):(?<page>[0-9]+)/i)
  async onTeachersListPage(@Ctx() ctx: ICallbackQueryContext) {
    const listId = ctx.match?.groups?.listId;
    const page = Number(ctx.match?.groups?.page) || 1;
    const state =
      listId && ctx.chat
        ? await this.teacherListStateService.get(listId, {
            transport: 'telegram',
            ownerId: ctx.from.id,
            peerId: ctx.chat.id,
          })
        : null;

    if (!state) {
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherListExpired),
      );
      return;
    }

    await this.renderTeachersList(
      ctx,
      listId!,
      state.query,
      state.pageSize,
      page,
    );
  }

  @Command('teacher')
  @Hears(teacherSearchCommandRegExp)
  async onTeacherSearch(@Ctx() ctx: IMessageContext) {
    const query = ctx.payload?.trim() || ctx.match?.groups?.query?.trim();
    if (!query) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherSearchHint),
      );
      return;
    }

    const { totalCount } = this.ystutyService.teachersList(1, 10, query);
    if (totalCount === 0) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotFound, {
          query: allowerHtmlTags(query, ''),
        }),
      );
      return;
    }

    await this.openTeachersList(ctx, query);
  }

  /** Создаёт отдельное Redis-состояние для нового сообщения со списком преподавателей. */
  private async openTeachersList(ctx: ICbQOrMsg, query: string) {
    if (!ctx.chat) return;

    const pageSize = 10;
    const listId = await this.teacherListStateService.create({
      transport: 'telegram',
      ownerId: ctx.from.id,
      peerId: ctx.chat.id,
      query,
      pageSize,
    });

    await this.renderTeachersList(ctx, listId, query, pageSize);
  }

  /** Рендерит указанную страницу, используя query исходного сообщения, а не session. */
  private async renderTeachersList(
    ctx: ICbQOrMsg,
    listId: string,
    query: string,
    pageSize: number,
    page = 1,
  ) {
    const { items, currentPage, totalPages } = this.ystutyService.teachersList(
      page,
      pageSize,
      query,
    );
    const keyboard = this.keyboardFactory.getTeachersListPagination(ctx, {
      listId,
      items,
      currentPage,
      totalPages,
    });
    const content = ctx.i18n.t(LocalePhrase.Page_Schedule_TeachersList, {
      currentPage,
      totalPages,
      query: allowerHtmlTags(query, ''),
    });

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      await ctx.tryAnswerCbQuery();
      return;
    }

    await ctx.replyWithHTML(content, keyboard);
  }

  @Hears(
    new RegExp(`\\/(?<command>cal(endar)?)(\\s+)?${patternGroupName}?`, 'i'),
  )
  async onCalendar(@Ctx() ctx: IMessageContext) {
    const selectedGroupName =
      ctx.chat.type === 'private'
        ? ctx.userSocial.groupName
        : ctx.sessionConversation.selectedGroupName;

    const groupNameFromMath = ctx.match?.groups?.groupName;
    const groupName = this.ystutyService.getGroupByName(
      groupNameFromMath || selectedGroupName,
    );

    if (!groupName) {
      if (selectedGroupName) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
            groupName: groupNameFromMath,
          }),
        );
        return;
      }
      await ctx.scene.enter(SELECT_GROUP_SCENE);
      return;
    }

    // TODO: update it
    const keyboard = this.keyboardFactory.getICalendarInline(
      ctx,
      `https://ical.ystuty.ru/group/${groupName}.ical`,
      `Calendar: ${groupName}`,
    );
    await ctx.replyWithHTML(
      `Ссылка для импорта расписания в сервис календаря:\n` +
        `<code>https://ical.ystuty.ru/group/${groupName}.ical</code>\n` +
        `<a href="https://ical.ystuty.ru/group/${groupName}.ical">Try me</a>\n\n` +
        `<a href="https://ics.ystuty.ru/#${groupName}">Пеерйти на сайт импорта</a>`,
      keyboard,
    );
  }

  @Action(LocalePhrase.Button_SelectGroup)
  async onSelectGroup(@Ctx() ctx: ICallbackQueryContext) {
    await ctx.scene.enter(SELECT_GROUP_SCENE);
    await ctx.answerCbQuery();
  }

  @TgHearsLocale([
    LocalePhrase.RegExp_Schedule_SelectGroup,
    LocalePhrase.Button_SelectGroup,
  ])
  @Action(/selectGroup:(?<groupName>(.*))/i)
  async hearSelectGroup(@Ctx() ctx: ICbQOrMsg) {
    const { from, chat, state, conversation, userSocial } = ctx;
    const groupName = ctx.match?.groups?.groupName;
    const withTrigger = !!ctx.match?.groups?.trigger;

    if (!chat || chat.type !== 'private') {
      if (!withTrigger && !state.appeal) {
        await ctx.tryAnswerCbQuery();
        return;
      }

      if (
        !conversation?.invitedByUserSocialId ||
        conversation.invitedByUserSocialId !== userSocial.id
      ) {
        try {
          const members = await ctx.telegram.getChatAdministrators(chat!.id);
          const status = members.find((e) => e.user.id === from.id)?.status;
          if (status && !['administrator', 'creator'].includes(status)) {
            return ctx.i18n.t(LocalePhrase.Error_SelectGroup_OnlyAdminOrOwner);
          }
        } catch (err) {
          if (err instanceof TelegramError) {
            // if (error.code === 917) {
            //     return ctx.i18n.t(LocalePhrase.Common_NoAccess);
            // }
            console.error(err);
            // return ctx.i18n.t(LocalePhrase.Error_Bot_NotAdmin);
            return ctx.i18n.t(LocalePhrase.Common_Error);
          }
          throw err;
        }
      }
    }

    await ctx.scene.enter(SELECT_GROUP_SCENE, { groupName });
    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      await ctx.deleteMessage();
    }
  }

  @Action(/selectTeacher:(?<listId>[a-f0-9]{12}):(?<teacherId>[0-9]+)/i)
  async hearSelectTeacher(@Ctx() ctx: ICallbackQueryContext) {
    const listId = ctx.match?.groups?.listId;
    const teacherId = Number(ctx.match?.groups?.teacherId);
    const state =
      listId && ctx.chat
        ? await this.teacherListStateService.get(listId, {
            transport: 'telegram',
            ownerId: ctx.from.id,
            peerId: ctx.chat.id,
          })
        : null;

    if (!state) {
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherListExpired),
      );
      return;
    }

    const teacher = this.ystutyService.getTeacher(teacherId);
    if (!teacher) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotFound, {
          query: teacherId,
        }),
      );
      return;
    }

    ctx.session.teacherId = teacherId;
    const safeTeacher = {
      ...teacher,
      name: allowerHtmlTags(teacher.name, ''),
    };
    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherSelected, {
        teacher: safeTeacher,
      }),
      this.keyboardFactory.getScheduleInline(ctx, {
        type: 'teacher',
        id: teacher.id,
      }),
    );

    if (ctx.chat?.type === 'private') {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherKeyboardUpdated),
        this.keyboardFactory.getStart(ctx),
      );
    }

    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      await ctx.deleteMessage();
    }
  }
}
