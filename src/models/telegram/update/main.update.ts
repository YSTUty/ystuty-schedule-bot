import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import {
  Action,
  Command,
  Ctx,
  Update,
  On,
  Start,
  Hears,
  Next,
} from '@xtcry/nestjs-telegraf';
import { TelegramError } from 'telegraf';
import type { Update as TgUpdate } from 'telegraf/types';

import * as xEnv from '@my-environment';
import {
  oAuth,
  patternGroupName,
  TelegrafExceptionFilter,
  TelegramAdminGuard,
  xs,
} from '@my-common';
import { TgHearsLocale } from '@my-common/decorator/tg';

import { LocalePhrase } from '@my-interfaces';
import {
  IContext,
  IMessageContext,
  ICallbackQueryContext,
  ICbQOrMsg,
} from '@my-interfaces/telegram';

import { YSTUtyService } from '../../ystuty/ystuty.service';

import { TelegramService } from '../telegram.service';
import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../telegram.constants';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class MainUpdate {
  private readonly logger = new Logger(MainUpdate.name);

  constructor(
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly ystutyService: YSTUtyService,
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
    const text = ctx.match.groups.text;
    await ctx.tryAnswerCbQuery(text);
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
    if (!user) {
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Auth_NeedAuth));
      return ctx.scene.enter(AUTH_SCENE);
    }

    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Profile_Info, { user }),
    );
  }

  @Command('update_profile')
  async onUpdateProfile(@Ctx() ctx: ICbQOrMsg) {
    const { user = null } = ctx;
    await ctx.tryAnswerCbQuery();
    if (!user) {
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Auth_NeedAuth));
      return ctx.scene.enter(AUTH_SCENE);
    }

    const oauthData = await new Promise<{
      err: { statusCode: number; data?: any };
      result?: string | Buffer;
    }>((resolve) =>
      oAuth.getProtectedResource(
        xEnv.OAUTH_URL + '/check',
        user.accessToken,
        (err, result) => resolve({ err, result }),
      ),
    );

    console.log('oauthData', oauthData);

    if (oauthData.err?.statusCode === 403) {
      return 'Wrong token';
    }

    if (!oauthData.result) {
      return 'No data';
    }

    let userData: {
      auth: number;
      userId: number;
      user: {
        id: number;
        firstName: string;
        lastName: string;
        patronymic: string;
        fullName: string;
        initials: string;
        avatarUrl: string;
        birthday: string;
        login: string;
        groupName?: string;
      };
    };
    try {
      userData = JSON.parse(oauthData.result as string).auth_info;
    } catch {
      return false;
    }

    await ctx.replyWithHTML(`
      <code>${JSON.stringify(userData, null, 2)}</code>
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
      new_chat_member: { status },
    } = ctx.myChatMember;
    if (chat.type === 'private') return;

    this.logger.log(`New bot status: "${status}"`);

    const { title } = chat;
    if (status === 'member') {
      const keyboard = this.keyboardFactory.getStart(ctx);
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);
      await this.telegramService.parseChatTitle(ctx, title);

      if (ctx.conversation) {
        ctx.conversation.invitedByUserSocialId = ctx.userSocial.id;
        ctx.conversation.title = title;
      }

      if (!ctx.sessionConversation.selectedGroupName) {
        const keyboard = this.keyboardFactory.getSelectGroupInline(ctx);
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_InitBot),
          keyboard,
        );
      }
    }
    // ! Проверить логику - юзер заблокирвоа бта или вышел из общего чата с этим ботом?
    else if (status === 'kicked' || status === 'left') {
      ctx.userSocial.isBlockedBot = true;
      if (ctx.conversation) {
        ctx.conversation.isLeaved = true;
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

  @Command('glist')
  @Action(/pager:glist(-(?<count>[0-9]+))?:(?<page>[0-9]+)/i)
  async onGroupsList(@Ctx() ctx: ICbQOrMsg) {
    let page: number = null;
    let count: number = null;

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
      await this.ystutyService.groupsList(page, count);

    const keyboard = this.keyboardFactory.getPagination(
      `glist-${count}`,
      currentPage,
      totalPages,
      items,
      'selectGroup:',
      [],
      true,
    );

    const content = xs`
        <b>Список групп</b>
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
  @Action(/pager:tlist(-(?<count>[0-9]+))?:(?<page>[0-9]+)/i)
  async onTeachersList(@Ctx() ctx: ICbQOrMsg) {
    let page: number = null;
    let count: number = null;

    if (ctx.updateType === 'callback_query') {
      if (ctx.match?.groups) {
        page = Number(ctx.match.groups.page);
        count = Number(ctx.match.groups.count);
      }
    } else if ('text' in ctx.message && !ctx.state.isLocalePhrase) {
      [, page, count] = ctx.message.text.split(' ').map(Number);
    }

    page = page || 1;
    count = count || 20;

    const { items, currentPage, totalPages } =
      await this.ystutyService.teachersList(page, count);

    const keyboard = this.keyboardFactory.getPagination(
      `tlist-${count}`,
      currentPage,
      totalPages,
      items.map((e) => ({
        title: e.name,
        payload: String(e.id),
      })),
      'selectTeacher:',
      [],
      true,
    );

    const content = xs`
        <b>Список преподавателей</b>
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

  @TgHearsLocale(LocalePhrase.RegExp_Schedule_SelectGroup)
  @Action(/selectGroup:(?<groupName>(.*))/i)
  async hearSelectGroup(@Ctx() ctx: ICbQOrMsg) {
    const { from, chat, state, conversation, userSocial } = ctx;
    const groupName = ctx.match?.groups?.groupName;
    const withTrigger = !!ctx.match?.groups?.trigger;

    if (chat.type !== 'private') {
      if (!withTrigger && !state.appeal) {
        await ctx.tryAnswerCbQuery();
        return;
      }

      if (
        !conversation?.invitedByUserSocialId ||
        conversation.invitedByUserSocialId !== userSocial.id
      ) {
        try {
          const members = await ctx.telegram.getChatAdministrators(chat.id);
          if (
            !['administrator', 'creator'].includes(
              members.find((e) => e.user.id === from.id)?.status,
            )
          ) {
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

  // @TgHearsLocale(LocalePhrase.RegExp_Schedule_SelectGroup)
  @Action(/selectTeacher:(?<teacherId>(.*))/i)
  async hearSelectTeacher(@Ctx() ctx: ICbQOrMsg) {
    const { chat } = ctx;
    const teacherId = Number(ctx.match?.groups?.teacherId);

    if (chat.type !== 'private') {
      await ctx.tryAnswerCbQuery('Nope');
      return;
    }

    // await ctx.scene.enter(SELECT_GROUP_SCENE, { teacherId });

    const teacherName = this.ystutyService.getTeacherName(teacherId);
    if (!teacherName) {
      await ctx.replyWithHTML(
        `Преподаватель с ID <code>${teacherId}</code> не найден.`,
      );
      return;
    }
    // ctx.userSocial.teacherId = teacherId;
    ctx.session.teacherId = teacherId;
    await ctx.replyWithHTML(`Выбран преподаватель: <b>${teacherName}</b>`);

    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      await ctx.deleteMessage();
    }
  }
}
