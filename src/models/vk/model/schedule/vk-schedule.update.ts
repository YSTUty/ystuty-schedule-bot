import { Logger, UseFilters } from '@nestjs/common';
import { Ctx, HearFallback, Hears, OnMessageEvent, Update } from 'nestjs-vk';

import {
  isPersonalTeacherScheduleCommand,
  isPersonalTeacherWeekCommand,
  personalTeacherScheduleCommandRegExp,
  personalTeacherWeekCommandRegExp,
  teacherListCommandRegExp,
  teacherSearchCommandRegExp,
  teacherSearchSlashCommandRegExp,
  VkExceptionFilter,
} from '@my-common';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

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
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../../vk.constants';
import { VkService } from '../../vk.service';

import { VkScheduleKeyboardFactory } from './vk-schedule-keyboard.factory';

type SchedulePayload = {
  phrase?: LocalePhrase;
  teacherId?: unknown;
  groupName?: unknown;
  weekNumber?: unknown;
};

/** Динамические подписи перехода недель маршрутизируются только по payload. */
export const vkScheduleWeekTextPhrases: LocalePhrase[] = [
  LocalePhrase.RegExp_Schedule_For_Week,
  LocalePhrase.Button_Schedule_ForWeek,
  LocalePhrase.Button_Schedule_ForNextWeek,
];

@Update()
@UseFilters(VkExceptionFilter)
export class VkScheduleUpdate {
  private readonly logger = new Logger(VkScheduleUpdate.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: VkScheduleKeyboardFactory,
    private readonly baseKeyboardFactory: VKKeyboardFactory,
    private readonly teacherListStateService: TeacherListStateService,
    private readonly vkService: VkService,
  ) {}

  @VkHearsLocale(LocalePhrase.Button_Calendar)
  async hearCalendar(@Ctx() ctx: IMessageContext) {
    await this.openCalendar(ctx);
  }

  @OnMessageEvent({ phrase: LocalePhrase.Button_Calendar })
  async onCalendarMessageEvent(@Ctx() ctx: IMessageEventContext) {
    await ctx.answer({ type: 'show_snackbar', text: 'Открываю календарь' });
    await this.openCalendar(ctx);
  }

  @OnMessageEvent({ teacherAction: 'list' })
  async onTeacherList(@Ctx() ctx: IMessageEventContext) {
    const state = await this.getTeacherListState(ctx);
    if (!state) {
      await this.openTeachersList(ctx, '');
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherListExpired),
      });
      return;
    }

    await this.renderTeachersList(
      ctx,
      String(ctx.eventPayload.listId),
      state.query,
      state.pageSize,
      Number(ctx.eventPayload.page) || 1,
    );
  }

  @OnMessageEvent({ teacherAction: 'select' })
  async onTeacherSelect(@Ctx() ctx: IMessageEventContext) {
    const state = await this.getTeacherListState(ctx);
    if (!state) {
      await this.openTeachersList(ctx, '');
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherListExpired),
      });
      return;
    }

    const teacherId = Number(ctx.eventPayload.teacherId);
    const teacher = this.scheduleService.getTeacher(teacherId);
    if (!teacher) {
      await ctx.answer({ type: 'show_snackbar', text: 'Not found' });
      return;
    }

    ctx.session.teacherId = teacher.id;
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message: ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherSelected, {
        teacher,
      }),
      keyboard: this.keyboardFactory
        .getSchedule(ctx, { type: 'teacher', id: teacher.id })
        .inline(),
    });
    if (ctx.isDM) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherKeyboardUpdated),
        { keyboard: this.baseKeyboardFactory.getStart(ctx) },
      );
    }
  }

  @OnMessageEvent({ phrase: LocalePhrase.Button_Schedule_Teacher })
  async onOpenTeachersList(@Ctx() ctx: IMessageEventContext) {
    await this.openTeachersList(ctx, '');
  }

  @Hears('/tlist')
  @Hears(teacherListCommandRegExp)
  @VkHearsLocale(LocalePhrase.Button_Schedule_Teacher)
  async onTeachersList(@Ctx() ctx: IMessageContext) {
    await this.openTeachersList(ctx, '');
  }

  @Hears(teacherSearchSlashCommandRegExp)
  @Hears(teacherSearchCommandRegExp)
  async onTeacherSearch(@Ctx() ctx: IMessageContext) {
    const query = ctx.$match?.groups?.query?.trim();
    if (!query) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherSearchHint));
      return;
    }

    const { totalCount } = this.scheduleService.teachersList(1, 20, query);
    if (totalCount === 0) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotFound, { query }),
      );
      return;
    }

    await this.openTeachersList(ctx, query);
  }

  /** Создаёт отдельное Redis-состояние для нового сообщения со списком преподавателей. */
  private async openTeachersList(
    ctx: IMessageContext | IMessageEventContext,
    query: string,
  ) {
    const pageSize = 5;
    const listId = await this.teacherListStateService.create({
      transport: 'vkontakte',
      ownerId: ctx.senderId || ctx.userId,
      peerId: ctx.peerId,
      query,
      pageSize,
    });

    await this.renderTeachersList(ctx, listId, query, pageSize);
  }

  /** Рендерит страницу списка по query, сохранённому в state конкретного сообщения. */
  private async renderTeachersList(
    ctx: IMessageContext | IMessageEventContext,
    listId: string,
    query: string,
    pageSize: number,
    page = 1,
  ) {
    const { items, currentPage, totalPages } =
      this.scheduleService.teachersList(page, pageSize, query);
    const message = ctx.i18n.t(LocalePhrase.Page_Schedule_TeachersList, {
      currentPage,
      totalPages,
      query,
    });

    const keyboard = this.keyboardFactory
      .getTeachersList({ ctx, listId, items, currentPage, totalPages })
      .inline();

    if ('eventPayload' in ctx) {
      await ctx.api.messages.edit({
        peer_id: ctx.peerId,
        cmid: ctx.conversationMessageId,
        message,
        keyboard,
      });
      return;
    }

    await ctx.send(message, { keyboard });
  }

  /** Открывает страницу создания календарной подписки для выбранных целей. */
  private async openCalendar(ctx: IMessageContext | IMessageEventContext) {
    const groupName = ctx.isDM
      ? ctx.state.userSocial.groupName
      : ctx.state.conversation?.groupName;
    const teacherId = ctx.isDM ? ctx.session.teacherId : undefined;
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
      await ctx.send(ctx.i18n.t(LocalePhrase.Common_Error));
      return;
    }

    await ctx.send(
      `${ctx.i18n.t(LocalePhrase.Page_Calendar)}\n\n${calendarUrl}`,
      {
        keyboard: this.keyboardFactory.getCalendarInline(
          ctx,
          calendarButtonUrl,
        ),
      },
    );
  }

  /** Проверяет, что callback относится к списку текущего пользователя и диалога. */
  private async getTeacherListState(ctx: IMessageEventContext) {
    const listId = ctx.eventPayload.listId;
    if (typeof listId !== 'string') return null;

    return await this.teacherListStateService.get(listId, {
      transport: 'vkontakte',
      ownerId: ctx.senderId || ctx.userId,
      peerId: ctx.peerId,
    });
  }

  @HearFallback()
  async onHearFallback(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM || !ctx.isMessageContext()) {
      return;
    }

    const query = ctx.text?.trim();
    if (!query) {
      return;
    }

    const groupName = this.scheduleService.getGroupByName(query);
    if (groupName) {
      await ctx.scene.enter(SELECT_GROUP_SCENE, {
        state: { groupName },
      });
      return;
    }

    if (this.scheduleService.isTeacherSearchFallbackQuery(query)) {
      await this.openTeachersList(ctx, query);
      return;
    }

    await ctx.send(ctx.i18n.t(LocalePhrase.Page_UnknownMessage), {
      keyboard: this.baseKeyboardFactory.getUnknownMessageHelp(ctx),
    });
  }

  @VkHearsLocale([
    LocalePhrase.RegExp_Schedule_For_OneDay,
    LocalePhrase.Button_Schedule_Schedule,
    LocalePhrase.Button_Schedule_ForToday,
    LocalePhrase.Button_Schedule_ForTomorrow,
    LocalePhrase.Button_Schedule_MyTeacher,
  ])
  @Hears('/tday')
  @Hears(personalTeacherScheduleCommandRegExp)
  /** Обрабатывает inline-переход к расписанию на сегодня или завтра. */
  @OnMessageEvent((payload) =>
    [
      LocalePhrase.Button_Schedule_ForToday,
      LocalePhrase.Button_Schedule_ForTomorrow,
    ].includes(payload.phrase as LocalePhrase),
  )
  async hearSchedul_OneDay(@Ctx() ctx: IMessageContext | IMessageEventContext) {
    const payload: SchedulePayload | undefined =
      ctx.messagePayload || ctx.eventPayload;
    const text = 'text' in ctx ? ctx.text : undefined;
    const teacherIdFromPayload = Number(payload?.teacherId);
    const isPersonalTeacherRequest =
      text?.trim().toLowerCase() === '/tday' ||
      isPersonalTeacherScheduleCommand(text) ||
      payload?.phrase === LocalePhrase.Button_Schedule_MyTeacher;
    const _skipDays = ctx.$match?.groups?.skipDays ?? null;
    let skipDays = Number(_skipDays) || 0;
    const presentation = ctx.$match?.groups?.detailed ? 'detailed' : 'compact';
    const isTomorrow =
      !!ctx.$match?.groups?.tomorrow ||
      payload?.phrase === LocalePhrase.Button_Schedule_ForTomorrow;
    const target = await this.resolveScheduleTarget(
      ctx,
      payload,
      teacherIdFromPayload ||
        (isPersonalTeacherRequest ? this.getPersonalTeacherId(ctx) : undefined),
      isPersonalTeacherRequest,
    );
    if (!target) return;

    let message: string | false | null;
    let days: number = 0;
    if (isTomorrow) {
      skipDays = 1;
      [days, message] = await this.scheduleService.findNext({
        skipDays,
        targetId: target.id,
        targetType: target.type,
        presentation,
      });
    } else if (_skipDays !== null) {
      message = await this.scheduleService.getFormatedSchedule({
        skipDays,
        targetId: target.id,
        targetType: target.type,
        presentation,
      });
      if (message === false) {
        message = ctx.i18n.t(LocalePhrase.Common_Error);
      }
    } else {
      [days, message] = await this.scheduleService.findNext({
        targetId: target.id,
        targetType: target.type,
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
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundDate, {
        date: formatScheduleTargetDate(getScheduleTargetDate(skipDays)),
      });
    }

    const keyboard = this.keyboardFactory
      .getSchedule(
        ctx,
        target.type === 'teacher'
          ? { type: 'teacher', id: Number(target.id) }
          : { type: 'group', id: String(target.id) },
      )
      .inline(true);
    const content = appendScheduleTargetFooter(message, target.name);
    if ('eventPayload' in ctx) {
      if (ctx.conversationMessageId === undefined) {
        await ctx.send(content, { keyboard });
        ctx.state.eventAnswered = true;
        return;
      }
      const result = await this.vkService.tryEditOrSendMessage(
        ctx.peerId,
        { conversation_message_id: ctx.conversationMessageId },
        content,
        { keyboard },
      );
      if (result !== false) {
        ctx.state.eventAnswered = true;
      }
      return;
    }
    await ctx.send(content, { keyboard });
  }

  @VkHearsLocale(vkScheduleWeekTextPhrases)
  @Hears('/tweek')
  @Hears(personalTeacherWeekCommandRegExp)
  /** Обрабатывает inline-переход между доступными неделями расписания. */
  @OnMessageEvent((payload) => {
    const phrase = payload.phrase as LocalePhrase;
    const isInitialWeekRequest = [
      LocalePhrase.Button_Schedule_ForWeek,
      LocalePhrase.Button_Schedule_ForNextWeek,
    ].includes(phrase);
    const isWeekNavigation = [
      LocalePhrase.Button_Schedule_PreviousWeek,
      LocalePhrase.Button_Schedule_NextWeek,
    ].includes(phrase);

    return (
      (isInitialWeekRequest ||
        (isWeekNavigation && Number.isInteger(Number(payload.weekNumber)))) &&
      (typeof payload.groupName === 'string' ||
        Number.isSafeInteger(Number(payload.teacherId)))
    );
  })
  async onScheduleWeekNavigation(
    @Ctx() ctx: IMessageContext | IMessageEventContext,
  ) {
    const payload: SchedulePayload | undefined =
      ctx.messagePayload || ctx.eventPayload;

    const teacherIdFromPayload = Number(payload?.teacherId);
    const isPersonalTeacherRequest =
      ('text' in ctx && ctx.text?.trim().toLowerCase() === '/tweek') ||
      isPersonalTeacherWeekCommand('text' in ctx ? ctx.text : undefined);
    const initialIsNextWeek =
      !!ctx.$match?.groups?.next ||
      payload?.phrase === LocalePhrase.Button_Schedule_ForNextWeek;
    const presentation = ctx.$match?.groups?.detailed ? 'detailed' : 'compact';
    const skipDays = initialIsNextWeek ? 7 + 1 : 1;
    const weekNumberFromPayload = Number(payload?.weekNumber);
    const requestedWeekNumber = Number.isInteger(weekNumberFromPayload)
      ? weekNumberFromPayload
      : getScheduleAcademicWeekNumber(getScheduleTargetDate(skipDays));
    const target = await this.resolveScheduleTarget(
      ctx,
      payload,
      teacherIdFromPayload ||
        (isPersonalTeacherRequest ? this.getPersonalTeacherId(ctx) : undefined),
      isPersonalTeacherRequest,
    );
    if (!target) return;

    const weekView = await this.scheduleService.getScheduleWeekView({
      targetId: target.id,
      targetType: target.type,
      requestedWeekNumber,
      presentation,
    });
    let message: string;
    let dateRange = getScheduleWeekDateRange(skipDays);
    let isNextWeek = initialIsNextWeek;
    let weekTitle: string | null = null;

    if (weekView === false) {
      message = ctx.i18n.t(LocalePhrase.Common_Error);
    } else if (weekView) {
      const weekDistance = getScheduleWeekDistance(
        weekView.weekStartDate,
        getScheduleTargetDate(1),
      );
      dateRange = weekView.dateRange;
      isNextWeek = weekDistance === 1;
      weekTitle = this.getWeekTitle(ctx, weekDistance);

      message = `${ctx.i18n.t(
        target.type === 'teacher'
          ? LocalePhrase.Page_Schedule_TeacherWeekTitle
          : LocalePhrase.Page_Schedule_WeekTitle,
        { weekNumber: weekView.weekNumber, dateRange, isNextWeek, weekTitle },
      )}\n${weekView.message}`;
    } else {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundWeek, {
        dateRange,
      });
    }

    const keyboard = this.keyboardFactory
      .getSchedule(
        ctx,
        target.type === 'teacher'
          ? { type: 'teacher', id: Number(target.id) }
          : { type: 'group', id: String(target.id) },
        weekView || undefined,
      )
      .inline(true);
    const content = appendScheduleTargetFooter(message, target.name);
    if ('eventPayload' in ctx) {
      if (ctx.conversationMessageId === undefined) {
        await ctx.send(content, { keyboard });
        ctx.state.eventAnswered = true;
        return;
      }
      const result = await this.vkService.tryEditOrSendMessage(
        ctx.peerId,
        { conversation_message_id: ctx.conversationMessageId },
        content,
        { keyboard },
      );
      if (result !== false) {
        ctx.state.eventAnswered = true;
      }
      return;
    }
    await ctx.send(content, { keyboard });
  }

  /** Определяет преподавателя или учебную группу для текущего запроса. */
  private async resolveScheduleTarget(
    ctx: IMessageContext | IMessageEventContext,
    payload: SchedulePayload | undefined,
    teacherId: number | undefined,
    isPersonalTeacherRequest: boolean,
  ): Promise<
    | { id: number; type: 'teacher'; name: string }
    | { id: string; type: 'group'; name: string }
    | undefined
  > {
    if (teacherId) {
      const teacher = this.scheduleService.getTeacher(teacherId);
      if (teacher) {
        return { id: teacher.id, type: 'teacher', name: teacher.name };
      }

      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotFound, {
          query: teacherId,
        }),
      );
      return undefined;
    }

    if (isPersonalTeacherRequest) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotSelected));
      return undefined;
    }

    const selectedGroupName = !ctx.isChat
      ? ctx.state.userSocial.groupName
      : ctx.state.conversation?.groupName;
    const groupNameFromMatch =
      ctx.$match?.groups?.groupTarget || ctx.$match?.groups?.groupName;
    const groupNameFromPayload =
      typeof payload?.groupName === 'string' ? payload.groupName : undefined;
    const groupNameQuery =
      groupNameFromMatch || groupNameFromPayload || selectedGroupName;
    const groupName =
      groupNameQuery &&
      (this.scheduleService.getGroupByName(groupNameQuery) ||
        this.scheduleService.parseGroupName(groupNameQuery));

    if (groupName) {
      return { id: groupName, type: 'group', name: groupName };
    }

    if (selectedGroupName) {
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
          groupName: groupNameFromMatch,
        }),
      );
      return undefined;
    }

    await ctx.scene.enter(SELECT_GROUP_SCENE);
    return undefined;
  }

  /** Использует ручной выбор либо однозначное совпадение ФИО профиля с расписанием. */
  private getPersonalTeacherId(ctx: IMessageContext | IMessageEventContext) {
    return (
      ctx.session.teacherId ??
      this.scheduleService.getTeacherByExactName(ctx.state.user?.fullname)?.id
    );
  }

  /** Формирует локализованный заголовок для недели вне текущей и следующей. */
  private getWeekTitle(
    ctx: IMessageContext | IMessageEventContext,
    weekDistance: number,
  ) {
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
