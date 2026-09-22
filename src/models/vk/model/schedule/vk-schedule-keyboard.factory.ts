import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';
import type { IKeyboardProxyButton } from 'vk-io/lib/structures/keyboard/types';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import type { ScheduleWeekView } from '../../../schedule/schedule.service';
import { getWebsiteUrl } from '../../../schedule/util/schedule-calendar-link.util';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

/** Клавиатуры transport-сценария расписания и преподавателей. */
@Injectable()
export class VkScheduleKeyboardFactory {
  constructor(private readonly baseKeyboardFactory: VKKeyboardFactory) {}

  public getSchedule(
    ctx: IContext,
    target: { type: 'group'; id: string } | { type: 'teacher'; id: number },
    weekView?: Pick<ScheduleWeekView, 'previousWeekNumber' | 'nextWeekNumber'>,
  ) {
    const payload = (phrase: LocalePhrase) => ({
      phrase,
      ...(target.type === 'teacher'
        ? { teacherId: target.id }
        : { groupName: target.id }),
    });

    const navigationButtons = [
      weekView?.previousWeekNumber !== undefined
        ? Keyboard.callbackButton({
            label: ctx.i18n.t(LocalePhrase.Button_Schedule_PreviousWeek, {
              weekNumber: weekView.previousWeekNumber,
            }),
            payload: {
              ...payload(LocalePhrase.Button_Schedule_PreviousWeek),
              weekNumber: weekView.previousWeekNumber,
            },
            color: Keyboard.SECONDARY_COLOR,
          })
        : null,
      weekView?.nextWeekNumber !== undefined
        ? Keyboard.callbackButton({
            label: ctx.i18n.t(LocalePhrase.Button_Schedule_NextWeek, {
              weekNumber: weekView.nextWeekNumber,
            }),
            payload: {
              ...payload(LocalePhrase.Button_Schedule_NextWeek),
              weekNumber: weekView.nextWeekNumber,
            },
            color: Keyboard.PRIMARY_COLOR,
          })
        : null,
    ].filter((button): button is IKeyboardProxyButton => button !== null);

    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForToday),
          payload: payload(LocalePhrase.Button_Schedule_ForToday),
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForTomorrow),
          payload: payload(LocalePhrase.Button_Schedule_ForTomorrow),
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForWeek),
          payload: payload(LocalePhrase.Button_Schedule_ForWeek),
          color: Keyboard.PRIMARY_COLOR,
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForNextWeek),
          payload: payload(LocalePhrase.Button_Schedule_ForNextWeek),
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      ...(navigationButtons.length ? [navigationButtons] : []),
    ]);
  }

  /** Постраничный список преподавателей для выбора расписания. */
  public getTeachersList(params: {
    ctx: IContext;
    listId: string;
    items: { id: number; name: string }[];
    currentPage: number;
    totalPages: number;
  }) {
    return this.baseKeyboardFactory.getPagination({
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((teacher) => ({
        title: teacher.name,
        payload: {
          teacherAction: 'select',
          listId: params.listId,
          teacherId: teacher.id,
        },
      })),
      getPagePayload: (page) => ({
        teacherAction: 'list',
        listId: params.listId,
        page,
      }),
    });
  }

  /** Открывает страницу создания календарной подписки с уже выбранными целями. */
  public getCalendarInline(ctx: IContext, link: string) {
    const webViewUrl = getWebsiteUrl(xEnv.SOCIAL_VK_WEB_VIEW_URL);

    return Keyboard.keyboard([
      [
        Keyboard.urlButton({
          label: ctx.i18n.t(LocalePhrase.Button_Calendar_Open),
          url: link,
        }),
        ...(webViewUrl
          ? [
              Keyboard.urlButton({
                label: ctx.i18n.t(LocalePhrase.Button_ScheduleWeb),
                url: webViewUrl,
              }),
            ]
          : []),
      ],
    ]).inline();
  }
}
