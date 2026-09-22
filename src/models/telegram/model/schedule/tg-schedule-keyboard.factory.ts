import { Injectable } from '@nestjs/common';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import type { ScheduleWeekView } from '../../../schedule/schedule.service';
import {
  TelegramMarkup as Markup,
  TelegramButtonOptions,
  TelegramButtons,
} from '../../telegram-buttons.util';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

/** Клавиатуры transport-сценария расписания и преподавателей. */
@Injectable()
export class TgScheduleKeyboardFactory {
  constructor(private readonly baseKeyboardFactory: TelegramKeyboardFactory) {}

  public getScheduleInline(
    ctx: IContext,
    target: { type: 'group'; id: string } | { type: 'teacher'; id: number },
    weekView?: Pick<ScheduleWeekView, 'previousWeekNumber' | 'nextWeekNumber'>,
  ) {
    // callback_data Telegram ограничен 64 байтами, поэтому группу передаём
    // коротким hash, а не её полным динамическим названием.
    const groupTarget =
      target.type === 'group' ? `g:${md5(target.id).slice(0, 12)}` : null;
    const makeButton = (
      phrase: LocalePhrase,
      style?: TelegramButtonOptions['style'],
    ) =>
      TelegramButtons.callback(
        ctx.i18n.t(phrase),
        target.type === 'teacher'
          ? `${phrase}:teacher:${target.id}`
          : `${phrase}:${groupTarget}`,
        { style },
      );

    const navigationButtons: ReturnType<typeof TelegramButtons.callback>[] = [];
    if (weekView?.previousWeekNumber !== undefined) {
      navigationButtons.push(
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Schedule_PreviousWeek, {
            weekNumber: weekView.previousWeekNumber,
          }),
          target.type === 'teacher'
            ? `${LocalePhrase.Button_Schedule_PreviousWeek}:teacher:${target.id}:week:${weekView.previousWeekNumber}`
            : `${LocalePhrase.Button_Schedule_PreviousWeek}:${groupTarget}:week:${weekView.previousWeekNumber}`,
        ),
      );
    }
    if (weekView?.nextWeekNumber !== undefined) {
      navigationButtons.push(
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Schedule_NextWeek, {
            weekNumber: weekView.nextWeekNumber,
          }),
          target.type === 'teacher'
            ? `${LocalePhrase.Button_Schedule_NextWeek}:teacher:${target.id}:week:${weekView.nextWeekNumber}`
            : `${LocalePhrase.Button_Schedule_NextWeek}:${groupTarget}:week:${weekView.nextWeekNumber}`,
        ),
      );
    }

    return Markup.inlineKeyboard([
      [
        makeButton(LocalePhrase.Button_Schedule_ForToday, 'primary'),
        makeButton(LocalePhrase.Button_Schedule_ForTomorrow),
      ],
      [
        makeButton(LocalePhrase.Button_Schedule_ForWeek, 'primary'),
        makeButton(LocalePhrase.Button_Schedule_ForNextWeek),
      ],
      ...(navigationButtons.length ? [navigationButtons] : []),
    ]);
  }

  /** Строит pagination конкретного списка преподавателей. */
  public getTeachersListPagination(
    _ctx: IContext,
    params: {
      listId: string;
      items: { id: number; name: string }[];
      currentPage: number;
      totalPages: number;
    },
  ) {
    return this.baseKeyboardFactory.getPagination({
      name: `teacher-list:${params.listId}`,
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((teacher) => ({
        title: teacher.name,
        payload: `${params.listId}:${teacher.id}`,
      })),
      actionPrefix: 'selectTeacher:',
      columnizer: true,
      sortByLength: false,
    });
  }

  /** Открывает страницу создания календарной подписки с уже выбранными целями. */
  public getCalendarInline(ctx: IContext, link: string) {
    return {
      ...Markup.inlineKeyboard([
        [
          TelegramButtons.url(
            ctx.i18n.t(LocalePhrase.Button_Calendar_Open),
            link,
            { style: 'primary' },
          ),
        ],
      ]),
    };
  }
}
