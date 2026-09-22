import { Injectable } from '@nestjs/common';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { buildScheduleNotifPage } from '../../../schedule-notif/schedule-notif-keyboard.util';
import {
  getScheduleNotifTargetPhrase,
  SCHEDULE_NOTIFICATION_MINUTES,
} from '../../../schedule-notif/schedule-notif-ui.util';
import {
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
} from '../../../schedule-notif/schedule-notif.types';
import {
  TelegramMarkup as Markup,
  TelegramButtons,
} from '../../telegram-buttons.util';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

@Injectable()
export class TgScheduleNotifKeyboardFactory {
  constructor(private readonly baseKeyboardFactory: TelegramKeyboardFactory) {}

  public getScheduleNotifHours(ctx: IContext, page = 1, notifId?: number) {
    const hours = buildScheduleNotifPage(
      Array.from({ length: 18 }, (_, index) => index + 6),
      page,
      18,
    );
    return Markup.inlineKeyboard([
      ...hours.rows.map((row) =>
        row.map((hour) =>
          Markup.button.callback(
            `${String(hour).padStart(2, '0')}:**`,
            notifId
              ? `scheduleNotif:editHour:${notifId}:${hour}`
              : `scheduleNotif:hour:${hour}`,
          ),
        ),
      ),
      ...(hours.totalPages > 1
        ? [
            [
              ...(hours.previousPage
                ? [
                    Markup.button.callback(
                      ctx.i18n.t(
                        LocalePhrase.Button_ScheduleNotif_PreviousPage,
                      ),
                      notifId
                        ? `scheduleNotif:editHours:${notifId}:${hours.previousPage}`
                        : `scheduleNotif:hours:${hours.previousPage}`,
                    ),
                  ]
                : []),
              Markup.button.callback(
                `${hours.currentPage}/${hours.totalPages}`,
                'nope',
              ),
              ...(hours.nextPage
                ? [
                    Markup.button.callback(
                      ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_NextPage),
                      notifId
                        ? `scheduleNotif:editHours:${notifId}:${hours.nextPage}`
                        : `scheduleNotif:hours:${hours.nextPage}`,
                    ),
                  ]
                : []),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          notifId ? `scheduleNotif:edit:${notifId}` : 'scheduleNotif:settings',
        ),
      ],
    ]);
  }

  public getScheduleNotifMinutes(
    ctx: IContext,
    hour: number,
    notifId?: number,
  ) {
    return Markup.inlineKeyboard([
      ...[
        SCHEDULE_NOTIFICATION_MINUTES.slice(0, 3),
        SCHEDULE_NOTIFICATION_MINUTES.slice(3),
      ].map((minuteRow) =>
        minuteRow.map((minute) =>
          Markup.button.callback(
            `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            notifId
              ? `scheduleNotif:editMinute:${notifId}:${hour}:${minute}`
              : `scheduleNotif:minute:${hour}:${minute}`,
          ),
        ),
      ),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          notifId
            ? `scheduleNotif:editHours:${notifId}:1`
            : 'scheduleNotif:hours:1',
        ),
      ],
    ]);
  }

  public getScheduleNotifTarget(ctx: IContext, hour: number, minute: number) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentDay),
          `scheduleNotif:target:${hour}:${minute}:day:0`,
        ),
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetNextDay),
          `scheduleNotif:target:${hour}:${minute}:day:1`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentWeek),
          `scheduleNotif:target:${hour}:${minute}:week`,
        ),
      ],
    ]);
  }

  public getScheduleNotifWeekdays(
    ctx: IContext,
    hour: number,
    minute: number,
    period: 'day' | 'week',
    targetDayOffset: number | null,
    weekdays: number[],
  ) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return Markup.inlineKeyboard([
      ...[0, 3, 6].map((startIndex) =>
        labels.slice(startIndex, startIndex + 3).map((label, index) => {
          const weekday = startIndex + index + 1;
          return Markup.button.callback(
            `${weekdays.includes(weekday) ? '✅' : '☐'} ${label}`,
            `scheduleNotif:weekday:${hour}:${minute}:${period}:${targetDayOffset ?? 'none'}:${weekday}:${weekdays.join(',')}`,
          );
        }),
      ),
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Done),
          `scheduleNotif:save:${hour}:${minute}:${period}:${targetDayOffset ?? 'none'}:${weekdays.join(',')}`,
          { style: 'success' },
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          `scheduleNotif:minute:${hour}`,
        ),
      ],
    ]);
  }

  public getScheduleNotifSettings(
    ctx: IContext,
    notifs: {
      id: number;
      isEnabled: boolean;
      targetLabel: string;
    }[],
    canCreate: boolean,
  ) {
    return Markup.inlineKeyboard([
      ...notifs.map((notif, index) => [
        TelegramButtons.callback(
          `${index + 1}. ${notif.targetLabel}`,
          `scheduleNotif:edit:${notif.id}`,
          { style: notif.isEnabled ? 'primary' : undefined },
        ),
      ]),
      ...(canCreate
        ? [
            [
              TelegramButtons.callback(
                notifs.length
                  ? ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Add)
                  : ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Create),
                'scheduleNotif:create',
                { style: 'success' },
              ),
            ],
          ]
        : []),
    ]);
  }

  /** Клавиатура редактирования сохраняет каждое изменение сразу. */
  public getScheduleNotifEditor(
    ctx: IContext,
    notif: {
      id: number;
      deliveryHour: number;
      deliveryMinute: number;
      period: 'day' | 'week';
      targetDayOffset: number | null;
      weekdays: number[];
      isEnabled: boolean;
    },
  ) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `Время: ${String(notif.deliveryHour).padStart(2, '0')}:${String(notif.deliveryMinute).padStart(2, '0')}`,
          `scheduleNotif:editTime:${notif.id}`,
        ),
      ],
      [
        Markup.button.callback(
          `Расписание: ${ctx.i18n.t(
            getScheduleNotifTargetPhrase(
              notif.period as ScheduleNotifPeriod,
              notif.targetDayOffset as ScheduleNotifTargetDayOffset | null,
            ),
          )}`,
          `scheduleNotif:editTarget:${notif.id}`,
        ),
      ],
      ...[0, 3, 6].map((startIndex) =>
        labels.slice(startIndex, startIndex + 3).map((label, index) => {
          const weekday = startIndex + index + 1;
          return Markup.button.callback(
            `${notif.weekdays.includes(weekday) ? '✅' : '☐'} ${label}`,
            `scheduleNotif:editWeekday:${notif.id}:${weekday}`,
          );
        }),
      ),
      [
        TelegramButtons.callback(
          `✏️ ${ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_ChangeTarget)}`,
          `scheduleNotif:changeTarget:${notif.id}`,
          { style: 'primary' },
        ),
        TelegramButtons.callback(
          `${notif.isEnabled ? '⏸️' : '▶️'} ${ctx.i18n.t(
            notif.isEnabled
              ? LocalePhrase.Button_ScheduleNotif_Disable
              : LocalePhrase.Button_ScheduleNotif_Enable,
          )}`,
          `scheduleNotif:enabled:${notif.id}:${notif.isEnabled ? '0' : '1'}`,
          { style: notif.isEnabled ? 'danger' : 'success' },
        ),
      ],
      [
        TelegramButtons.callback(
          `🗑️ ${ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Delete)}`,
          `scheduleNotif:deleteConfirm:${notif.id}`,
          { style: 'danger' },
        ),
        TelegramButtons.callback(
          `✅ ${ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Done)}`,
          'scheduleNotif:editSave',
          { style: 'success' },
        ),
      ],
    ]);
  }

  /** Выбор содержимого для уже сохранённой рассылки. */
  public getScheduleNotifEditorTarget(ctx: IContext, notif: { id: number }) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentDay),
          `scheduleNotif:editPeriod:${notif.id}:day:0`,
        ),
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetNextDay),
          `scheduleNotif:editPeriod:${notif.id}:day:1`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentWeek),
          `scheduleNotif:editPeriod:${notif.id}:week:none`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          `scheduleNotif:edit:${notif.id}`,
        ),
      ],
    ]);
  }

  /** Подтверждение защищает от случайного удаления настройки рассылки. */
  public getScheduleNotifDeleteConfirmation(ctx: IContext, notifId: number) {
    return Markup.inlineKeyboard([
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_DeleteConfirm),
          `scheduleNotif:delete:${notifId}`,
          { style: 'danger' },
        ),
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_DeleteCancel),
          'scheduleNotif:settings',
        ),
      ],
    ]);
  }

  public getScheduleNotifTargetType(
    ctx: IContext,
    callbackPrefix: string,
    canSelectGroup: boolean,
    backCallback?: string,
  ) {
    return Markup.inlineKeyboard([
      [
        ...(canSelectGroup
          ? [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetGroup),
                `${callbackPrefix}:group`,
              ),
            ]
          : []),
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetTeacher),
          `${callbackPrefix}:teacher`,
        ),
      ],
      ...(backCallback
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
                backCallback,
              ),
            ],
          ]
        : []),
    ]);
  }

  /** Список преподавателей для выбора цели рассылки без смены session.teacherId. */
  public getScheduleNotifTeachersList(
    ctx: IContext,
    params: {
      items: { id: number; name: string }[];
      currentPage: number;
      totalPages: number;
    },
  ) {
    return this.baseKeyboardFactory.getPagination({
      name: 'sched-notif-teachers',
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((teacher) => ({
        title: teacher.name,
        payload: String(teacher.id),
      })),
      actionPrefix: 'sched-notif-teacher:select:',
      columnizer: true,
      sortByLength: false,
      additionalButtons: [
        [
          Markup.button.callback(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
            'sched-notif-teacher:cancel',
          ),
        ],
      ],
    });
  }
}
