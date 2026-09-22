import { Logger, UseFilters } from '@nestjs/common';
import { Command, Ctx, Hears, Update } from 'nestjs-telega';

import { TelegramError } from 'telegraf-hardened';

import {
  md5,
  selectGroupCommandRegExp,
  TelegrafExceptionFilter,
  xs,
} from '@my-common';
import { Action, TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext, ICbQOrMsg } from '@my-interfaces/telegram';

import { ScheduleService } from '../../../schedule/schedule.service';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../../telegram.constants';
import { TelegramService } from '../../telegram.service';

import { TgGroupSelectionKeyboardFactory } from './tg-group-selection-keyboard.factory';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class TgGroupSelectionUpdate {
  private readonly logger = new Logger(TgGroupSelectionUpdate.name);

  constructor(
    private readonly keyboardFactory: TgGroupSelectionKeyboardFactory,
    private readonly baseKeyboardFactory: TelegramKeyboardFactory,
    private readonly scheduleService: ScheduleService,
    private readonly telegramService: TelegramService,
  ) {}

  @TgHearsLocale(LocalePhrase.Button_Groups_ListInstAndGroups)
  @Command('institutes')
  @Hears(/^институт(ы)?$/i)
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
      this.scheduleService.groupsInstitutesList(page, count);

    const keyboard = this.baseKeyboardFactory.getPagination({
      name: `inst-list-${count}`,
      currentPage,
      totalPages,
      items: items.map((title) => ({ title, payload: md5(title) })),
      actionPrefix: 'pager:glist:',
      columnizer: true,
      additionalButtons: [[this.keyboardFactory.getAllGroupsListButton(ctx)]],
    });

    const content = xs`
      <b>Список институтов</b>
      <code>---☼ (${currentPage}/${totalPages}) ☼---</code>
    `;

    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      return;
    }

    await ctx.replyWithHTML(content, keyboard);
  }

  @Command('groups')
  @Command('glist')
  // legacy button
  @Hears(/^📚 Список групп 📚$/i)
  @Hears(/^группы$/i)
  @Action(
    /pager:glist(:(?<instituteHash>[a-f0-9]{32}))?(-(?<count>[0-9]+))?(:(?<page>[0-9]+))?/i,
  )
  async onGroupsList(@Ctx() ctx: ICbQOrMsg) {
    let page: number | null = null;
    let count: number | null = null;
    let instituteHash: string | null = null;

    if (ctx.updateType === 'callback_query') {
      if (ctx.match?.groups) {
        instituteHash = ctx.match.groups.instituteHash;
        page = Number(ctx.match.groups.page);
        count = Number(ctx.match.groups.count);
      }
    } else if ('text' in ctx.message && !ctx.state.isLocalePhrase) {
      [, page, count] = ctx.message.text.split(' ').map(Number);
    }

    page = page || 1;
    count = count || 26;

    // TODO: после подтверждения picker рассылки перенести профильный список на общий слой.
    const { items, currentPage, totalPages } = this.scheduleService.groupsList(
      page,
      count,
      instituteHash,
    );
    const keyboard = this.baseKeyboardFactory.getPagination({
      name: `glist${instituteHash ? `:${instituteHash}` : ''}-${count}`,
      currentPage,
      totalPages,
      items: items.map((groupName) => ({
        title: groupName,
        payload: md5(groupName).slice(0, 12),
      })),
      actionPrefix: 'selectGroup:',
      additionalButtons: instituteHash
        ? [this.keyboardFactory.getInstitutesListButton(ctx)]
        : [],
      columnizer: true,
    });
    const instituteName = instituteHash
      ? this.scheduleService.instituteNameByHash(instituteHash)
      : null;
    const content = xs`
      <b>Список групп${instituteName ? ` <i>(${instituteName})</i>` : ''}</b>
      <code>---☼ (${currentPage}/${totalPages}) ☼---</code>
    `;

    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      return;
    }

    await ctx.replyWithHTML(content, keyboard);
  }

  @Action(LocalePhrase.Button_SelectGroup)
  async onSelectGroup(@Ctx() ctx: ICallbackQueryContext) {
    // await ctx.scene.enter(SELECT_GROUP_SCENE);
    // await ctx.tryAnswerCbQuery();
    await this.onInstitutesList(ctx);
  }

  @TgHearsLocale([
    LocalePhrase.RegExp_Schedule_SelectGroup,
    LocalePhrase.Button_SelectGroup,
  ])
  @Hears(selectGroupCommandRegExp)
  @Action(/selectGroup:(?<groupName>(.*))/i)
  async hearSelectGroup(@Ctx() ctx: ICbQOrMsg) {
    const { from, chat, state, conversation, userSocial } = ctx;
    const callbackGroupName = ctx.match?.groups?.groupName;
    // Старые сообщения ещё содержат полное имя группы; новые передают hash,
    // чтобы не превысить лимит callback_data в Telegram.
    const groupName = callbackGroupName
      ? this.scheduleService.groupNameByHash(callbackGroupName) ||
        callbackGroupName
      : undefined;
    const withTrigger = !!ctx.match?.groups?.trigger;

    if (!chat || chat.type !== 'private') {
      // Для текстовых команд в беседе требуется обращение к боту. Inline
      // callback уже является явным действием пользователя по кнопке.
      if (!ctx.callbackQuery && !withTrigger && !state.appeal) {
        await ctx.tryAnswerCbQuery();
        return;
      }

      if (
        !conversation?.invitedByUserSocialId ||
        conversation.invitedByUserSocialId !== userSocial.id
      ) {
        try {
          const members = await this.telegramService.getCachedChatAdmins(
            chat!.id,
          );
          const status = members.find(
            (member) => member.user.id === from.id,
          )?.status;
          if (status && !['administrator', 'creator'].includes(status)) {
            return ctx.i18n.t(LocalePhrase.Error_SelectGroup_OnlyAdminOrOwner);
          }
        } catch (err) {
          if (err instanceof TelegramError) {
            this.logger.warn(
              `[TG][select-group] cannot read chat admins chat=${chat!.id}: ${err.message}`,
            );
            // if (error.code === 917) {
            //   return ctx.i18n.t(LocalePhrase.Common_NoAccess);
            // }
            // return ctx.i18n.t(LocalePhrase.Error_Bot_NotAdmin);
            return ctx.i18n.t(LocalePhrase.Common_Error);
          }
          throw err;
        }
      }
    }

    if (!groupName) {
      await this.onInstitutesList(ctx);
      return;
    }

    await ctx.scene.enter(SELECT_GROUP_SCENE, { groupName });
    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      await ctx.deleteMessage();
    }
  }
}
