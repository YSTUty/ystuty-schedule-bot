import { UseFilters } from '@nestjs/common';
import { Ctx, Hears, Update } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';

import { YSTUtyService } from '../../ystuty/ystuty.service';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../vk.constants';

@Update()
@UseFilters(VkExceptionFilter)
export class ScheduleUpdate {
  constructor(
    private readonly ystutyService: YSTUtyService,
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
  async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
    const teacherIdFromPayload = Number(ctx.messagePayload?.teacherId);
    const isPersonalTeacherRequest =
      ctx.text?.trim().toLowerCase() === '/tday' ||
      ctx.messagePayload?.phrase === LocalePhrase.Button_Schedule_MyTeacher;
    const _skipDays = ctx.$match?.groups?.skipDays ?? null;
    let skipDays = Number(_skipDays) || 0;
    const isTomorrow =
      !!ctx.$match?.groups?.tomorrow ||
      ctx.messagePayload?.phrase === LocalePhrase.Button_Schedule_ForTomorrow;
    const target = await this.resolveScheduleTarget(
      ctx,
      teacherIdFromPayload ||
        (isPersonalTeacherRequest ? this.getPersonalTeacherId(ctx) : undefined),
      isPersonalTeacherRequest,
    );
    if (!target) return;

    await ctx.setActivity();

    let message: string | false | null;
    let days: number = 0;
    if (isTomorrow) {
      skipDays = 1;
      [days, message] = await this.ystutyService.findNext({
        skipDays,
        targetId: target.id,
        targetType: target.type,
      });
    } else if (_skipDays !== null) {
      message = await this.ystutyService.getFormatedSchedule({
        skipDays,
        targetId: target.id,
        targetType: target.type,
      });
      if (message === false) {
        message = ctx.i18n.t(LocalePhrase.Common_Error);
      }
    } else {
      [days, message] = await this.ystutyService.findNext({
        targetId: target.id,
        targetType: target.type,
      });
    }

    if (message && days - 1 > skipDays) {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
        days,
        content: message,
      });
    }

    if (!message) {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday);
    }

    const keyboard = this.keyboardFactory
      .getSchedule(
        ctx,
        target.type === 'teacher'
          ? { type: 'teacher', id: Number(target.id) }
          : { type: 'group', id: String(target.id) },
      )
      .inline(true);
    await ctx.send(`${message}\n[${target.name}]`, { keyboard });
  }

  @VkHearsLocale([
    LocalePhrase.RegExp_Schedule_For_Week,
    LocalePhrase.Button_Schedule_ForWeek,
    LocalePhrase.Button_Schedule_ForNextWeek,
  ])
  @Hears('/tweek')
  async hearSchedul_Week(@Ctx() ctx: IMessageContext) {
    const teacherIdFromPayload = Number(ctx.messagePayload?.teacherId);
    const isPersonalTeacherRequest =
      ctx.text?.trim().toLowerCase() === '/tweek';
    const isNextWeek =
      !!ctx.$match?.groups?.next ||
      ctx.messagePayload?.phrase === LocalePhrase.Button_Schedule_ForNextWeek;
    const skipDays = isNextWeek ? 7 + 1 : 1;
    const target = await this.resolveScheduleTarget(
      ctx,
      teacherIdFromPayload ||
        (isPersonalTeacherRequest ? this.getPersonalTeacherId(ctx) : undefined),
      isPersonalTeacherRequest,
    );
    if (!target) return;

    await ctx.setActivity();

    const [days, scheduleMessage] = await this.ystutyService.findNext({
      skipDays,
      targetId: target.id,
      targetType: target.type,
      isWeek: true,
    });
    let message = scheduleMessage;

    if (message) {
      if (days - 1 > skipDays) {
        message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
          days,
          content: message,
        });
      }

      message = `${ctx.i18n.t(
        target.type === 'teacher'
          ? LocalePhrase.Page_Schedule_TeacherWeekTitle
          : LocalePhrase.Page_Schedule_WeekTitle,
        { isNextWeek },
      )}\n${message}`;
    } else {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday);
    }

    const keyboard = this.keyboardFactory
      .getSchedule(
        ctx,
        target.type === 'teacher'
          ? { type: 'teacher', id: Number(target.id) }
          : { type: 'group', id: String(target.id) },
      )
      .inline(true);
    await ctx.send(`${message}\n[${target.name}]`, { keyboard });
  }

  /** Определяет преподавателя или учебную группу для текущего запроса. */
  private async resolveScheduleTarget(
    ctx: IMessageContext,
    teacherId: number | undefined,
    isPersonalTeacherRequest: boolean,
  ): Promise<
    | { id: number; type: 'teacher'; name: string }
    | { id: string; type: 'group'; name: string }
    | undefined
  > {
    if (teacherId) {
      const teacher = this.ystutyService.getTeacher(teacherId);
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
      : ctx.sessionConversation.selectedGroupName;
    const groupNameFromMatch = ctx.$match?.groups?.groupName;
    const groupName = this.ystutyService.getGroupByName(
      groupNameFromMatch || ctx.messagePayload?.groupName || selectedGroupName,
    );

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
  private getPersonalTeacherId(ctx: IMessageContext) {
    return (
      ctx.session.teacherId ??
      this.ystutyService.getTeacherByExactName(ctx.state.user?.fullname)?.id
    );
  }
}
