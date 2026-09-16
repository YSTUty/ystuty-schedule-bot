import { UseFilters } from '@nestjs/common';
import { Ctx, Hears, OnMessageEvent, Update } from 'nestjs-vk';

import {
  isPersonalTeacherScheduleCommand,
  isPersonalTeacherWeekCommand,
  personalTeacherScheduleCommandRegExp,
  personalTeacherWeekCommandRegExp,
  VkExceptionFilter,
} from '@my-common';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { ScheduleService } from '../../schedule/schedule.service';
import { appendScheduleTargetFooter } from '../../schedule/util/schedule-formatter.util';
import {
  formatScheduleTargetDate,
  getScheduleAcademicWeekNumber,
  getScheduleTargetDate,
  getScheduleWeekDateRange,
  getScheduleWeekDistance,
} from '../../schedule/util/schedule.util';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../vk.constants';

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
export class ScheduleUpdate {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @VkHearsLocale([
    LocalePhrase.RegExp_Schedule_For_OneDay,
    LocalePhrase.Button_Schedule_Schedule,
    LocalePhrase.Button_Schedule_ForToday,
    LocalePhrase.Button_Schedule_ForTomorrow,
    LocalePhrase.Button_Schedule_MyTeacher,
  ])
  @Hears('/tday')
  @Hears(personalTeacherScheduleCommandRegExp)
  async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
    const teacherIdFromPayload = Number(ctx.messagePayload?.teacherId);
    const isPersonalTeacherRequest =
      ctx.text?.trim().toLowerCase() === '/tday' ||
      isPersonalTeacherScheduleCommand(ctx.text) ||
      ctx.messagePayload?.phrase === LocalePhrase.Button_Schedule_MyTeacher;
    const _skipDays = ctx.$match?.groups?.skipDays ?? null;
    let skipDays = Number(_skipDays) || 0;
    const presentation = ctx.$match?.groups?.detailed ? 'detailed' : 'compact';
    const isTomorrow =
      !!ctx.$match?.groups?.tomorrow ||
      ctx.messagePayload?.phrase === LocalePhrase.Button_Schedule_ForTomorrow;
    const target = await this.resolveScheduleTarget(
      ctx,
      ctx.messagePayload,
      teacherIdFromPayload ||
        (isPersonalTeacherRequest ? this.getPersonalTeacherId(ctx) : undefined),
      isPersonalTeacherRequest,
    );
    if (!target) return;

    try {
      await ctx.setActivity();
    } catch {}

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
    await ctx.send(appendScheduleTargetFooter(message, target.name), {
      keyboard,
    });
  }

  @VkHearsLocale(vkScheduleWeekTextPhrases)
  @Hears('/tweek')
  @Hears(personalTeacherWeekCommandRegExp)
  /** Обрабатывает inline-переход между доступными неделями расписания. */
  @OnMessageEvent(
    (payload) =>
      [
        LocalePhrase.Button_Schedule_PreviousWeek,
        LocalePhrase.Button_Schedule_NextWeek,
      ].includes(payload.phrase as LocalePhrase) &&
      Number.isInteger(Number(payload.weekNumber)) &&
      (typeof payload.groupName === 'string' ||
        Number.isSafeInteger(Number(payload.teacherId))),
  )
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

    try {
      await ctx.setActivity();
    } catch {}

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
      await ctx.editMessage({ message: content, keyboard });
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
