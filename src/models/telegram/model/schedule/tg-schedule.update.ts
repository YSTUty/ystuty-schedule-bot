import { Logger, UseFilters } from '@nestjs/common';
import { Command, Ctx, Hears, Next, On, Update } from 'nestjs-telega';

import * as tg from 'telegraf-hardened/types';
import type { Update as TgUpdate } from 'telegraf-hardened/types';

import {
  allowerHtmlTags,
  isPersonalTeacherScheduleCommand,
  isPersonalTeacherWeekCommand,
  patternTeacherId,
  personalTeacherScheduleCommandRegExp,
  personalTeacherWeekCommandRegExp,
  teacherListCommandRegExp,
  teacherSearchCommandRegExp,
  TelegrafExceptionFilter,
} from '@my-common';
import {
  Action,
  AllowedChatTypes,
  TgHearsLocale,
} from '@my-common/decorator/tg';
import { LocalePhrase, TelegramLocalePhrase } from '@my-interfaces';
import {
  ICallbackQueryContext,
  ICbQOrMsg,
  IContext,
  IMessageContext,
} from '@my-interfaces/telegram';

import { ScheduleService } from '../../../schedule/schedule.service';
import { TeacherListStateService } from '../../../schedule/teacher-list-state.service';
import {
  getScheduleCalendarButtonUrl,
  getScheduleCalendarWebUrl,
} from '../../../schedule/util/schedule-calendar-link.util';
import { appendScheduleTargetFooter } from '../../../schedule/util/schedule-formatter.util';
import {
  formatScheduleTargetDate,
  getScheduleAcademicWeekNumber,
  getScheduleTargetDate,
  getScheduleWeekDateRange,
  getScheduleWeekDistance,
} from '../../../schedule/util/schedule.util';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../../telegram.constants';
import { TelegramService } from '../../telegram.service';

import { TgScheduleKeyboardFactory } from './tg-schedule-keyboard.factory';

/**
 * Группа в callback — значение из клавиатуры, а не текстовая команда.
 * Новые кнопки передают hash, старые — полное имя без разделителя `:`.
 */
const groupCallbackTargetPattern = 'g:[a-f0-9]{12}|[^:]+';

export const createGroupScheduleActionRegExp = (phrase: LocalePhrase) =>
  new RegExp(
    `^(?<phrase>${phrase.replaceAll('.', '\\.')})(?::(?<groupTarget>${groupCallbackTargetPattern}))?$`,
    'i',
  );

export const createGroupScheduleWeekNavigationActionRegExp = (
  phrase: LocalePhrase,
) =>
  new RegExp(
    `^(?<phrase>${phrase.replaceAll('.', '\\.')}):(?<groupTarget>${groupCallbackTargetPattern}):week:(?<weekNumber>-?\\d+)$`,
    'i',
  );

@Update()
@UseFilters(TelegrafExceptionFilter)
export class TgScheduleUpdate {
  private readonly logger = new Logger(TgScheduleUpdate.name);

  constructor(
    private readonly keyboardFactory: TgScheduleKeyboardFactory,
    private readonly baseKeyboardFactory: TelegramKeyboardFactory,
    private readonly scheduleService: ScheduleService,
    private readonly teacherListStateService: TeacherListStateService,
    private readonly telegramService: TelegramService,
  ) {}

  @On('inline_query')
  async onInlineQuery(@Ctx() ctx: IContext<{}, TgUpdate.InlineQueryUpdate>) {
    // TODO: add to queue and wait

    const groupNameQuery =
      ctx.inlineQuery.query.trim() || ctx.userSocial?.groupName;
    const groupName = this.scheduleService.resolveGroupName(groupNameQuery);
    if (!groupName) {
      if (ctx.userSocial?.groupName) {
        await ctx.answerInlineQuery(
          [
            {
              id: 'schedule:404',
              type: 'sticker',
              sticker_file_id:
                // ? how long will it last
                'CAACAgIAAxkBAAEEJypiLmxc-eE-xdTeukvAF29X_VcjXAAC-gADVp29Ckfe-pdxdHEBIwQ',
            },
          ],
          { cache_time: 30, is_personal: true },
        );
        return;
      }

      const start_parameter = LocalePhrase.Button_SelectGroup.replace(
        /\./g,
        '--',
      );
      await ctx.answerInlineQuery([], {
        // is_personal: true,
        cache_time: 10,
        button: {
          text: ctx.i18n.t(TelegramLocalePhrase.Page_SelectYourGroup),
          start_parameter,
        },
      });
      return;
    }

    let messageDay = await this.scheduleService.getFormatedSchedule({
      targetId: groupName,
      targetType: 'group',
      withTags: true,
    });
    if (!messageDay) {
      if (messageDay === false) {
        messageDay = `${ctx.i18n.t(LocalePhrase.Common_Error)}\n`;
      } else {
        messageDay = `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundDate, {
          date: formatScheduleTargetDate(getScheduleTargetDate()),
        })}\n`;
      }
    }

    const messageTomorrow =
      (
        await this.scheduleService.findNext({
          skipDays: 1,
          groupName,
          withTags: true,
        })
      )[1] ||
      `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundDate, {
        date: formatScheduleTargetDate(getScheduleTargetDate(1)),
      })}\n`;

    const messageWeek =
      (
        await this.scheduleService.findNext({
          skipDays: 1,
          groupName,
          isWeek: true,
          withTags: true,
        })
      )[1] ||
      `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundWeek, {
        dateRange: getScheduleWeekDateRange(1),
      })}\n`;

    const reply_markup = {
      inline_keyboard: [
        [
          {
            text:
              ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Share) + ' где-то',
            switch_inline_query: groupName,
          },
        ],
        [
          {
            text: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Share) + ' тут',
            switch_inline_query_current_chat: groupName,
          },
        ],
      ],
    };

    const results: tg.InlineQueryResult[] = [];
    const cropStr = (str: string) =>
      str.length > 120 ? `${str.slice(0, 120)}...` : str;

    results.push({
      type: 'article',
      id: `schedule:${groupName}:day`,
      title: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Title_ForToday, {
        groupName,
      }),
      description: cropStr(allowerHtmlTags(messageDay, '')),
      input_message_content: {
        message_text: appendScheduleTargetFooter(messageDay, groupName),
        parse_mode: 'HTML',
      },
      reply_markup,
    });

    results.push({
      type: 'article',
      id: `schedule:${groupName}:tomorrow`,
      title: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Title_ForTomorrow, {
        groupName,
      }),
      description: cropStr(allowerHtmlTags(messageTomorrow, '')),
      input_message_content: {
        message_text: appendScheduleTargetFooter(messageTomorrow, groupName),
        parse_mode: 'HTML',
      },
      reply_markup,
    });

    results.push({
      type: 'article',
      id: `schedule:${groupName}:week`,
      title: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Title_ForWeek, {
        groupName,
      }),
      description: cropStr(allowerHtmlTags(messageWeek, '')),
      input_message_content: {
        message_text: appendScheduleTargetFooter(messageWeek, groupName),
        parse_mode: 'HTML',
      },
      reply_markup,
    });

    await ctx.answerInlineQuery(results, {
      is_personal: true,
      cache_time: 60,
    });
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

    const { totalCount } = this.scheduleService.teachersList(1, 10, query);
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
    const { items, currentPage, totalPages } =
      this.scheduleService.teachersList(page, pageSize, query);
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

  @Hears(/^\/(?:cal|calendar)(?:@\w+)?(?:\s+(?<groupName>.+))?$/i)
  @TgHearsLocale(LocalePhrase.Button_Calendar)
  @Action('calendar:open')
  async onCalendar(@Ctx() ctx: ICbQOrMsg) {
    if (ctx.updateType === 'callback_query') {
      await ctx.tryAnswerCbQuery();
    }

    const requestedGroupName = ctx.match?.groups?.groupName?.trim();
    const selectedGroupName =
      ctx.chat?.type === 'private'
        ? ctx.userSocial?.groupName
        : ctx.conversation?.groupName;
    const groupNameQuery = requestedGroupName || selectedGroupName;
    const groupName = this.scheduleService.resolveGroupName(groupNameQuery);

    if (requestedGroupName && !groupName) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
          groupName: requestedGroupName,
        }),
      );
      return;
    }

    const teacherId =
      !requestedGroupName && ctx.chat?.type === 'private'
        ? ctx.session.teacherId
        : undefined;
    if (!groupName && !teacherId) {
      await ctx.scene.enter(SELECT_GROUP_SCENE);
      return;
    }

    const targets = [groupName, teacherId];
    const calendarUrl = getScheduleCalendarWebUrl(targets);
    const calendarButtonUrl = getScheduleCalendarButtonUrl(targets);

    if (!calendarUrl || !calendarButtonUrl) {
      this.logger.error(
        '[iCalendar] YSTUTY_ICALENDAR_ADDRESS is not configured',
      );
      await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Common_Error));
      return;
    }

    await ctx.replyWithHTML(
      `${ctx.i18n.t(LocalePhrase.Page_Calendar)}\n\n<code>${calendarUrl}</code>`,
      this.keyboardFactory.getCalendarInline(ctx, calendarButtonUrl),
    );
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

    const teacher = this.scheduleService.getTeacher(teacherId);
    if (!teacher) {
      await ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotFound, {
          query: teacherId,
        }),
      );
      return;
    }

    ctx.session.teacherId = teacherId;
    if (ctx.chat?.type === 'private') {
      await this.telegramService.syncPrivateChatCommands({
        chatId: ctx.chat.id,
        isAuthorized: !!ctx.user,
        isAdmin: this.telegramService.isAdmin(ctx.from.id, ctx.user?.role),
        hasGroup: !!ctx.userSocial.groupName,
        teacherId,
      });
    }
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
        this.baseKeyboardFactory.getStart(ctx),
      );
    }

    if (ctx.callbackQuery) {
      await ctx.tryAnswerCbQuery();
      await ctx.deleteMessage();
    }
  }

  /** Обрабатывает нераспознанное ФИО преподавателя только в личных сообщениях. */
  @On('text')
  @AllowedChatTypes('private')
  async onTeacherNameFallback(@Ctx() ctx: IMessageContext, @Next() next) {
    if (!('text' in ctx.message)) return next();

    const query = ctx.message.text.trim();
    const groupName = this.scheduleService.getGroupByName(query);
    if (groupName) {
      await ctx.scene.enter(SELECT_GROUP_SCENE, { groupName });
      return;
    }

    if (!this.scheduleService.isTeacherSearchFallbackQuery(query))
      return next();

    await this.openTeachersList(ctx, query);
  }

  @Command('tt')
  @Command('day')
  @Command('tday')
  @Hears(personalTeacherScheduleCommandRegExp)
  @TgHearsLocale([
    LocalePhrase.RegExp_Schedule_For_OneDay,
    LocalePhrase.Button_Schedule_Schedule,
    LocalePhrase.Button_Schedule_ForToday,
    LocalePhrase.Button_Schedule_ForTomorrow,
    LocalePhrase.Button_Schedule_MyTeacher,
  ])
  @Action(
    [
      LocalePhrase.Button_Schedule_Schedule,
      LocalePhrase.Button_Schedule_ForToday,
      LocalePhrase.Button_Schedule_ForTomorrow,
    ].map(createGroupScheduleActionRegExp),
  )
  @Action(
    [
      LocalePhrase.Button_Schedule_Schedule,
      LocalePhrase.Button_Schedule_ForToday,
      LocalePhrase.Button_Schedule_ForTomorrow,
    ].map(
      (e) =>
        new RegExp(
          `^(?<phrase>${e.replaceAll('.', '\\.')}):teacher:${patternTeacherId}$`,
          'i',
        ),
    ),
  )
  async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
    if (ctx.isUnaddressedGroupMessage()) return;

    const teacherIdFromMath = ctx.match?.groups?.teacherId;
    const isPersonalTeacherCommand =
      ctx.command === 'tday' ||
      (ctx.message &&
        'text' in ctx.message &&
        isPersonalTeacherScheduleCommand(ctx.message.text)) ||
      (ctx.message &&
        'text' in ctx.message &&
        ctx.message.text ===
          ctx.i18n.t(LocalePhrase.Button_Schedule_MyTeacher));
    const selectedTeacherId = teacherIdFromMath
      ? Number(teacherIdFromMath)
      : isPersonalTeacherCommand
        ? this.getPersonalTeacherId(ctx)
        : undefined;

    let targetId: string | number;
    let targetType: 'group' | 'teacher';

    if (selectedTeacherId) {
      targetId = selectedTeacherId;
      targetType = 'teacher';
    } else {
      if (isPersonalTeacherCommand) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotSelected),
        );
        return;
      }

      const groupNameFromMatch =
        ctx.match?.groups?.groupTarget || ctx.match?.groups?.groupName;
      const selectedGroupName = this.getSelectedGroupName(ctx);
      const groupName = this.resolveGroupName(ctx, groupNameFromMatch);

      if (!groupName) {
        if (selectedGroupName) {
          await ctx.replyWithHTML(
            ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
              groupName: groupNameFromMatch,
            }),
          );
          return;
        }
        await ctx.scene.enter(SELECT_GROUP_SCENE);
        return;
      }

      targetId = groupName;
      targetType = 'group';
    }

    const _skipDays = ctx.match?.groups?.skipDays ?? null;
    let skipDays = Number(_skipDays) || 0;
    const presentation = ctx.match?.groups?.detailed ? 'detailed' : 'compact';
    const isTomorrow =
      !!ctx.match?.groups?.tomorrow ||
      ctx.match?.groups?.phrase === LocalePhrase.Button_Schedule_ForTomorrow;

    if (!ctx.callbackQuery) {
      await ctx.sendChatAction('typing');
    }

    let message: string | false | null;
    let days: number = 0;
    if (isTomorrow) {
      skipDays = 1;
      [days, message] = await this.scheduleService.findNext({
        skipDays,
        targetId,
        targetType,
        withTags: true,
        presentation,
      });
    } else if (_skipDays !== null) {
      message = await this.scheduleService.getFormatedSchedule({
        skipDays,
        targetId,
        targetType,
        withTags: true,
        presentation,
      });
      if (message === false) {
        message = `${ctx.i18n.t(LocalePhrase.Common_Error)}\n`;
      }
    } else {
      [days, message] = await this.scheduleService.findNext({
        targetId,
        targetType,
        withTags: true,
        presentation,
      });
    }

    if (message && days - 1 > skipDays) {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
        days,
        content: message,
      });
    }

    if (!message) {
      message = `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundDate, {
        date: formatScheduleTargetDate(getScheduleTargetDate(skipDays)),
      })}\n`;
    }

    const targetName = allowerHtmlTags(
      targetType === 'group'
        ? String(targetId)
        : this.scheduleService.getTeacherName(+targetId) || '',
      '',
    );

    const keyboard = this.keyboardFactory.getScheduleInline(
      ctx,
      targetType === 'teacher'
        ? { type: 'teacher', id: Number(targetId) }
        : { type: 'group', id: String(targetId) },
    );
    const content = appendScheduleTargetFooter(message, targetName);

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch (error) {
        this.logger.warn(
          `[TG][schedule] cannot edit callback message; sending a new response: ${error instanceof Error ? error.message : String(error)}`,
        );
        await ctx.replyWithHTML(content, keyboard);
      }
      await ctx.tryAnswerCbQuery();
    } else {
      await ctx.replyWithHTML(content, keyboard);
    }
  }

  @Command('week')
  @Command('tweek')
  @Hears(personalTeacherWeekCommandRegExp)
  @TgHearsLocale([
    LocalePhrase.RegExp_Schedule_For_Week,
    LocalePhrase.Button_Schedule_ForWeek,
    LocalePhrase.Button_Schedule_ForNextWeek,
  ])
  @Action(
    [
      LocalePhrase.Button_Schedule_ForWeek,
      LocalePhrase.Button_Schedule_ForNextWeek,
    ].map(createGroupScheduleActionRegExp),
  )
  @Action(
    [
      LocalePhrase.Button_Schedule_ForWeek,
      LocalePhrase.Button_Schedule_ForNextWeek,
    ].map(
      (e) =>
        new RegExp(
          `^(?<phrase>${e.replaceAll('.', '\\.')}):teacher:${patternTeacherId}$`,
          'i',
        ),
    ),
  )
  @Action(
    [
      LocalePhrase.Button_Schedule_PreviousWeek,
      LocalePhrase.Button_Schedule_NextWeek,
    ].flatMap((phrase) => [
      new RegExp(
        `^(?<phrase>${phrase.replaceAll('.', '\\.')}):teacher:${patternTeacherId}:week:(?<weekNumber>-?\\d+)$`,
        'i',
      ),
      createGroupScheduleWeekNavigationActionRegExp(phrase),
    ]),
  )
  async hearSchedul_Week(@Ctx() ctx: IMessageContext) {
    if (ctx.isUnaddressedGroupMessage()) return;

    const teacherIdFromMath = ctx.match?.groups?.teacherId;
    const isPersonalTeacherCommand =
      ctx.command === 'tweek' ||
      (ctx.message &&
        'text' in ctx.message &&
        isPersonalTeacherWeekCommand(ctx.message.text)) ||
      (ctx.message &&
        'text' in ctx.message &&
        ctx.message.text ===
          ctx.i18n.t(LocalePhrase.Button_Schedule_MyTeacher));
    const selectedTeacherId = teacherIdFromMath
      ? Number(teacherIdFromMath)
      : isPersonalTeacherCommand
        ? this.getPersonalTeacherId(ctx)
        : undefined;

    let targetId: string | number;
    let targetType: 'group' | 'teacher';

    if (selectedTeacherId) {
      targetId = selectedTeacherId;
      targetType = 'teacher';
    } else {
      if (isPersonalTeacherCommand) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotSelected),
        );
        return;
      }

      const groupNameFromMatch =
        ctx.match?.groups?.groupTarget || ctx.match?.groups?.groupName;
      const selectedGroupName = this.getSelectedGroupName(ctx);
      const groupName = this.resolveGroupName(ctx, groupNameFromMatch);

      if (!groupName) {
        if (selectedGroupName) {
          await ctx.replyWithHTML(
            ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
              groupName: groupNameFromMatch,
            }),
          );
          return;
        }
        await ctx.scene.enter(SELECT_GROUP_SCENE);
        return;
      }

      targetId = groupName;
      targetType = 'group';
    }

    const initialIsNextWeek =
      !!ctx.match?.groups?.next ||
      ctx.match?.groups?.phrase === LocalePhrase.Button_Schedule_ForNextWeek;
    const presentation = ctx.match?.groups?.detailed ? 'detailed' : 'compact';
    const skipDays = initialIsNextWeek ? 7 + 1 : 1;
    const weekNumberFromMatch = Number(ctx.match?.groups?.weekNumber);
    const requestedWeekNumber = Number.isInteger(weekNumberFromMatch)
      ? weekNumberFromMatch
      : getScheduleAcademicWeekNumber(getScheduleTargetDate(skipDays));

    if (!ctx.callbackQuery) {
      await ctx.sendChatAction('typing');
    }

    const weekView = await this.scheduleService.getScheduleWeekView({
      targetId,
      targetType,
      requestedWeekNumber,
      withTags: true,
      presentation,
    });
    let message: string;
    let dateRange = getScheduleWeekDateRange(skipDays);
    let isNextWeek = initialIsNextWeek;
    let weekTitle: string | null = null;

    if (weekView === false) {
      message = `${ctx.i18n.t(LocalePhrase.Common_Error)}\n`;
    } else if (weekView) {
      const weekDistance = getScheduleWeekDistance(
        weekView.weekStartDate,
        getScheduleTargetDate(1),
      );
      dateRange = weekView.dateRange;
      isNextWeek = weekDistance === 1;
      weekTitle = this.getWeekTitle(ctx, weekDistance);

      message = `${ctx.i18n.t(
        targetType === 'teacher'
          ? LocalePhrase.Page_Schedule_TeacherWeekTitle
          : LocalePhrase.Page_Schedule_WeekTitle,
        { weekNumber: weekView.weekNumber, dateRange, isNextWeek, weekTitle },
      )}\n${weekView.message}`;
    } else {
      message = `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundWeek, {
        dateRange,
      })}\n`;
    }

    const targetName = allowerHtmlTags(
      targetType === 'group'
        ? String(targetId)
        : this.scheduleService.getTeacherName(+targetId) || '',
      '',
    );

    const keyboard = this.keyboardFactory.getScheduleInline(
      ctx,
      targetType === 'teacher'
        ? { type: 'teacher', id: Number(targetId) }
        : { type: 'group', id: String(targetId) },
      weekView || undefined,
    );
    const content = appendScheduleTargetFooter(message, targetName);

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch (error) {
        this.logger.warn(
          `[TG][schedule] cannot edit callback message; sending a new response: ${error instanceof Error ? error.message : String(error)}`,
        );
        await ctx.replyWithHTML(content, keyboard);
      }
      await ctx.tryAnswerCbQuery();
    } else {
      // Use stream message for example
      if (Math.random() > 0.5) {
        await ctx.sendStreamingMessage(content, {
          parse_mode: 'HTML',
          // chunkDelay: 80,
        });
        return;
      }
      await ctx.replyWithHTML(content, keyboard);
    }
  }

  /** Возвращает выбранного преподавателя или однозначное совпадение ФИО профиля. */
  private getPersonalTeacherId(ctx: IMessageContext) {
    return (
      ctx.session.teacherId ??
      this.scheduleService.getTeacherByExactName(ctx.user?.fullname)?.id
    );
  }

  /** Находит группу из команды, callback или постоянной настройки текущего чата. */
  private resolveGroupName(ctx: IMessageContext, groupTarget?: string) {
    const groupNameQuery = groupTarget || this.getSelectedGroupName(ctx);
    const groupHash = groupTarget
      ? /^g:(?<hash>[a-f0-9]{12})$/i.exec(groupTarget)?.groups?.hash
      : undefined;

    if (groupHash) {
      return this.scheduleService.groupNameByHash(groupHash);
    }

    return this.scheduleService.resolveGroupName(groupNameQuery);
  }

  /** Возвращает личную группу либо группу, сохранённую у conversation. */
  private getSelectedGroupName(ctx: IMessageContext) {
    return ctx.chat.type === 'private'
      ? ctx.userSocial.groupName
      : ctx.conversation?.groupName;
  }

  /** Формирует локализованный заголовок для недели вне текущей и следующей. */
  private getWeekTitle(ctx: IMessageContext, weekDistance: number) {
    if (weekDistance === 0 || weekDistance === 1) return null;
    if (weekDistance === -1) {
      return ctx.i18n.t(LocalePhrase.Page_Schedule_WeekTitle_Previous);
    }

    return weekDistance < 0
      ? ctx.i18n.t(LocalePhrase.Page_Schedule_WeekTitle_Past, {
          weeks: Math.abs(weekDistance),
        })
      : ctx.i18n.t(LocalePhrase.Page_Schedule_WeekTitle_Future, {
          weeks: weekDistance,
        });
  }
}
