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
import * as tg from 'telegraf/typings/core/types/typegram';
import type { Update as TgUpdate } from 'telegraf/types';

import {
  patternGroupName,
  TelegrafExceptionFilter,
  TelegramAdminGuard,
  xs,
} from '@my-common';
import { LocalePhrase, TelegramLocalePhrase } from '@my-interfaces';
import {
  IContext,
  IMessageContext,
  ICallbackQueryContext,
  ICbQOrMsg,
} from '@my-interfaces/telegram';
import { TgHearsLocale } from '@my-common/decorator/tg';

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
  onAdmin(@Ctx() ctx: IMessageContext) {
    ctx.reply('YOUARE ADMIN');
  }

  @Command('broke')
  async onBroke(@Ctx() ctx: IMessageContext) {
    throw new Error('Whoops');
  }

  @Action(/nope(:(?<text>.*))?/)
  onNopeAction(@Ctx() ctx: ICallbackQueryContext) {
    const text = ctx.match.groups.text;
    ctx.tryAnswerCbQuery(text);
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

    if (
      ctx.chat.type === 'private' &&
      (!ctx.session.selectedGroupName || !ctx.session.user)
    ) {
      const keyboard = !ctx.session.user
        ? this.keyboardFactory.getAuth(
            ctx,
            true,
            true,
            !ctx.session.selectedGroupName,
          )
        : this.keyboardFactory.getSelectGroupInline(ctx);
      ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_InitBot), keyboard);
      return;
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);
  }

  @Hears('/profile')
  async onProfile(@Ctx() ctx: IMessageContext) {
    const { user = null } = ctx.session;
    if (!user) {
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Auth_NeedAuth));
      await ctx.scene.enter(AUTH_SCENE);
      return;
    }

    await ctx.replyWithHTML(
      ctx.i18n.t(LocalePhrase.Page_Profile_Info, { user }),
    );
  }

  @Hears(['/auth', 'login', 'войти'])
  @TgHearsLocale([
    LocalePhrase.Button_AuthLink,
    LocalePhrase.Button_AuthLink_SocialConnect,
  ])
  onAuth(@Ctx() ctx: IMessageContext) {
    // ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Auth_Intro));
    ctx.scene.enter(AUTH_SCENE);
  }

  @TgHearsLocale(LocalePhrase.RegExp_Help)
  hearHelp(@Ctx() ctx: IMessageContext) {
    if (ctx.chat.type !== 'private' && !ctx.state.appeal) {
      return;
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Help), keyboard);
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
      this.telegramService.parseChatTitle(ctx, title);
      if (!ctx.sessionConversation.selectedGroupName) {
        const keyboard = this.keyboardFactory.getSelectGroupInline(ctx);
        ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_InitBot), keyboard);
      }
    } else if (status === 'left') {
      // TODO: remove all setting ?
    }
  }

  @On('new_chat_title')
  onNewChatTitle(@Ctx() ctx: IMessageContext) {
    if ('new_chat_title' in ctx.message) {
      this.telegramService.parseChatTitle(ctx, ctx.message.new_chat_title);
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
    // ctx.replyWithHTML(`List: ${JSON.stringify(this.ystutyService.groupNames)}`);
    let page = 1;
    let count = 10;

    if (ctx.updateType === 'callback_query') {
      page = Number(ctx.match.groups.page);
      count = Number(ctx.match.groups.count);
    } else if ('text' in ctx.message) {
      [, page = 1, count = 10] = ctx.message.text.split(' ').map(Number);
    }

    const { items, currentPage, totalPages } =
      await this.ystutyService.groupsList(page, count);

    const keyboard = this.keyboardFactory.getPagination(
      `glist-${count}`,
      currentPage,
      totalPages,
      items,
      'selectGroup',
    );

    const content = xs`
            <b>Groups list</b>
            <pre>---☼ (${currentPage}/${totalPages}) ☼---</pre>
        `;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      ctx.tryAnswerCbQuery();
    } else {
      ctx.replyWithHTML(content, keyboard);
    }
  }

  @Hears(
    new RegExp(`\\/(?<command>cal(endar)?)(\\s+)?${patternGroupName}?`, 'i'),
  )
  async onCalendar(@Ctx() ctx: IMessageContext) {
    const session =
      ctx.chat.type === 'private' ? ctx.session : ctx.sessionConversation;

    const groupNameFromMath = ctx.match?.groups?.groupName;
    const groupName = this.ystutyService.getGroupByName(
      groupNameFromMath || session.selectedGroupName,
    );

    if (!groupName) {
      if (session.selectedGroupName) {
        ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
            groupName: groupNameFromMath,
          }),
        );
        return;
      }
      ctx.scene.enter(SELECT_GROUP_SCENE);
      return;
    }

    const keyboard = this.keyboardFactory.getICalendarInline(
      ctx,
      `https://parser.ystuty.ru/api/calendar/group/${groupName}.ical`,
      `Calendar: ${groupName}`,
    );
    ctx.replyWithHTML(
      `Calendar import link:\n` +
        `<code>https://parser.ystuty.ru/api/calendar/group/${groupName}.ical</code>\n` +
        `<a href="https://parser.ystuty.ru/api/calendar/group/${groupName}.ical">Try me</a>\n\n`,
      keyboard,
    );
  }

  @Action(LocalePhrase.Button_SelectGroup)
  async onSelectGroup(@Ctx() ctx: IMessageContext) {
    ctx.scene.enter(SELECT_GROUP_SCENE);
    ctx.answerCbQuery();
  }

  @Action([
    LocalePhrase.Button_AuthLink,
    LocalePhrase.Button_AuthLink_SocialConnect,
  ])
  async onAuthLink(@Ctx() ctx: IMessageContext) {
    const { socialConnectLink } = ctx.session;
    if (socialConnectLink) {
      await ctx.answerCbQuery('Go', { url: socialConnectLink });
      delete ctx.session.socialConnectLink;
    } else {
      await ctx.editMessageReplyMarkup(
        this.keyboardFactory.getClear().reply_markup,
      );
      await ctx.answerCbQuery('Enter');
      await ctx.scene.enter(AUTH_SCENE);
    }
  }

  @TgHearsLocale(LocalePhrase.RegExp_Schedule_SelectGroup)
  @Action(/selectGroup:(?<groupName>(.*))/i)
  async hearSelectGroup(@Ctx() ctx: ICbQOrMsg) {
    const { from, chat, state } = ctx;
    const groupName = ctx.match?.groups?.groupName;
    const withTrigger = !!ctx.match?.groups?.trigger;

    if (chat.type !== 'private') {
      if (!withTrigger && !state.appeal) {
        ctx.tryAnswerCbQuery();
        return;
      }

      try {
        const members = await ctx.telegram.getChatAdministrators(chat.id);

        if (
          !['administrator', 'creator'].includes(
            members.find((e) => e.user.id === from.id)?.status,
          )
        ) {
          return ctx.i18n.t(LocalePhrase.Common_NoAccess);
        }
      } catch (err) {
        if (err instanceof TelegramError) {
          // if (error.code === 917) {
          //     return ctx.i18n.t(LocalePhrase.Common_NoAccess);
          // }
          console.error(err);
          return ctx.i18n.t(LocalePhrase.Common_Error);
        }
        throw err;
      }
    }

    await ctx.scene.enter(SELECT_GROUP_SCENE, { groupName });
    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      ctx.deleteMessage();
    }
  }
}
