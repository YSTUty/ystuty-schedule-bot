import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import { buildScheduleNotifPage } from '../../../schedule-notif/schedule-notif-keyboard.util';
import {
  getScheduleNotifTargetPhrase,
  SCHEDULE_NOTIFICATION_MINUTES,
} from '../../../schedule-notif/schedule-notif-ui.util';
import {
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
} from '../../../schedule-notif/schedule-notif.types';
import { getVKButtonLabel, VKKeyboardFactory } from '../../vk-keyboard.factory';

@Injectable()
export class VkScheduleNotifKeyboardFactory {
  constructor(private readonly baseKeyboardFactory: VKKeyboardFactory) {}

  public getScheduleNotifHours(ctx: IContext, page = 1, notifId?: number) {
    const hours = buildScheduleNotifPage(
      Array.from({ length: 18 }, (_, index) => index + 6),
      page,
      6,
    );
    return this.baseKeyboardFactory.getPagination({
      currentPage: hours.currentPage,
      totalPages: hours.totalPages,
      items: hours.rows.map((row) =>
        row.map((hour) => ({
          title: `${String(hour).padStart(2, '0')}:**`,
          payload: notifId
            ? {
                scheduleNotifAction: 'editHour',
                notifId,
                hour,
              }
            : { scheduleNotifAction: 'hour', hour },
        })),
      ),
      getPagePayload: (nextPage) => ({
        scheduleNotifAction: notifId ? 'editHours' : 'hours',
        page: nextPage,
        ...(notifId ? { notifId } : {}),
      }),
      additionalButtons: [
        [
          Keyboard.callbackButton({
            label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
            payload: {
              scheduleNotifAction: notifId ? 'edit' : 'settings',
              ...(notifId ? { notifId } : {}),
            },
          }),
        ],
      ],
      pagerMode: 'compact',
    });
  }

  public getScheduleNotifMinutes(
    ctx: IContext,
    hour: number,
    notifId?: number,
  ) {
    return Keyboard.keyboard([
      ...[
        SCHEDULE_NOTIFICATION_MINUTES.slice(0, 3),
        SCHEDULE_NOTIFICATION_MINUTES.slice(3),
      ].map((minuteRow) =>
        minuteRow.map((minute) =>
          Keyboard.callbackButton({
            label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            payload: notifId
              ? {
                  scheduleNotifAction: 'editMinute',
                  notifId,
                  hour,
                  minute,
                }
              : { scheduleNotifAction: 'minute', hour, minute },
          }),
        ),
      ),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          payload: {
            scheduleNotifAction: notifId ? 'editHours' : 'hours',
            page: 1,
            ...(notifId ? { notifId } : {}),
          },
        }),
      ],
    ]);
  }

  public getScheduleNotifTarget(ctx: IContext, hour: number, minute: number) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentDay),
          ),
          payload: {
            scheduleNotifAction: 'target',
            hour,
            minute,
            period: ScheduleNotifPeriod.Day,
            targetDayOffset: 0,
          },
        }),
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetNextDay),
          ),
          payload: {
            scheduleNotifAction: 'target',
            hour,
            minute,
            period: ScheduleNotifPeriod.Day,
            targetDayOffset: 1,
          },
        }),
      ],
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentWeek),
          ),
          payload: {
            scheduleNotifAction: 'target',
            hour,
            minute,
            period: ScheduleNotifPeriod.Week,
            targetDayOffset: null,
          },
        }),
      ],
    ]);
  }

  public getScheduleNotifWeekdays(
    ctx: IContext,
    hour: number,
    minute: number,
    period: ScheduleNotifPeriod,
    targetDayOffset: number | null,
    weekdays: number[],
  ) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return Keyboard.keyboard([
      ...[0, 3, 6].map((startIndex) =>
        labels.slice(startIndex, startIndex + 3).map((label, index) => {
          const weekday = startIndex + index + 1;
          return Keyboard.callbackButton({
            label: `${weekdays.includes(weekday) ? '✅' : '☐'} ${label}`,
            payload: {
              scheduleNotifAction: 'weekday',
              hour,
              minute,
              period,
              targetDayOffset,
              weekday,
              weekdays,
            },
          });
        }),
      ),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Done),
          payload: {
            scheduleNotifAction: 'save',
            hour,
            minute,
            period,
            targetDayOffset,
            weekdays,
          },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          payload: { scheduleNotifAction: 'minute', hour },
        }),
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
    page = 1,
  ) {
    // Четыре настройки, pager и действие создания укладываются в шесть рядов VK.
    const notifPage = buildScheduleNotifPage(notifs, page, 4, 1);
    return this.baseKeyboardFactory.getPagination({
      currentPage: notifPage.currentPage,
      totalPages: notifPage.totalPages,
      items: notifPage.rows.map((row) =>
        row.map((notif) => {
          const index = notifs.findIndex((item) => item.id === notif.id) + 1;
          return {
            title: `${index}. ${notif.targetLabel}`,
            payload: { scheduleNotifAction: 'edit', notifId: notif.id },
            selected: notif.isEnabled,
          };
        }),
      ),
      getPagePayload: (nextPage) => ({
        scheduleNotifAction: 'settings',
        page: nextPage,
      }),
      additionalButtons: canCreate
        ? [
            [
              Keyboard.callbackButton({
                label: notifs.length
                  ? ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Add)
                  : ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Create),
                payload: { scheduleNotifAction: 'create' },
                color: Keyboard.POSITIVE_COLOR,
              }),
            ],
          ]
        : [],
      pagerMode: 'compact',
    });
  }

  /** Клавиатура редактирования сохраняет каждое изменение сразу. */
  public getScheduleNotifEditor(
    ctx: IContext,
    notif: {
      id: number;
      deliveryHour: number;
      deliveryMinute: number;
      period: ScheduleNotifPeriod;
      targetDayOffset: number | null;
      weekdays: number[];
      isEnabled: boolean;
    },
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            `Время: ${String(notif.deliveryHour).padStart(2, '0')}:${String(notif.deliveryMinute).padStart(2, '0')}`,
          ),
          payload: {
            scheduleNotifAction: 'editTime',
            notifId: notif.id,
          },
        }),
      ],
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            `Расписание: ${ctx.i18n.t(
              getScheduleNotifTargetPhrase(
                notif.period,
                notif.targetDayOffset as ScheduleNotifTargetDayOffset | null,
              ),
            )}`,
          ),
          payload: {
            scheduleNotifAction: 'editTarget',
            notifId: notif.id,
          },
        }),
      ],
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel('Дни недели'),
          payload: {
            scheduleNotifAction: 'editWeekdays',
            notifId: notif.id,
          },
        }),
      ],
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            `✏️ ${ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_ChangeTarget)}`,
          ),
          payload: {
            scheduleNotifAction: 'changeTarget',
            notifId: notif.id,
          },
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            `${notif.isEnabled ? '⏸️' : '▶️'} ${ctx.i18n.t(
              notif.isEnabled
                ? LocalePhrase.Button_ScheduleNotif_Disable
                : LocalePhrase.Button_ScheduleNotif_Enable,
            )}`,
          ),
          payload: {
            scheduleNotifAction: 'enabled',
            notifId: notif.id,
            isEnabled: !notif.isEnabled,
          },
          color: notif.isEnabled
            ? Keyboard.NEGATIVE_COLOR
            : Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            `🗑️ ${ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Delete)}`,
          ),
          payload: {
            scheduleNotifAction: 'deleteConfirm',
            notifId: notif.id,
          },
          color: Keyboard.NEGATIVE_COLOR,
        }),
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            `✅ ${ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Done)}`,
          ),
          payload: { scheduleNotifAction: 'editSave' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
    ]);
  }

  /** Выбор содержимого для уже сохранённой рассылки. */
  public getScheduleNotifEditorTarget(ctx: IContext, notif: { id: number }) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentDay),
          ),
          payload: {
            scheduleNotifAction: 'editPeriod',
            notifId: notif.id,
            period: ScheduleNotifPeriod.Day,
            targetDayOffset: ScheduleNotifTargetDayOffset.Today,
          },
        }),
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetNextDay),
          ),
          payload: {
            scheduleNotifAction: 'editPeriod',
            notifId: notif.id,
            period: ScheduleNotifPeriod.Day,
            targetDayOffset: ScheduleNotifTargetDayOffset.Tomorrow,
          },
        }),
      ],
      [
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetCurrentWeek),
          ),
          payload: {
            scheduleNotifAction: 'editPeriod',
            notifId: notif.id,
            period: ScheduleNotifPeriod.Week,
            targetDayOffset: null,
          },
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          payload: { scheduleNotifAction: 'edit', notifId: notif.id },
        }),
      ],
    ]);
  }

  /** Вторая страница выбора дней редактора: VK ограничивает inline-клавиатуру десятью кнопками. */
  public getScheduleNotifEditorWeekdays(
    ctx: IContext,
    notif: {
      id: number;
      weekdays: number[];
    },
  ) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return Keyboard.keyboard([
      ...[0, 3, 6].map((startIndex) =>
        labels.slice(startIndex, startIndex + 3).map((label, index) => {
          const weekday = startIndex + index + 1;
          return Keyboard.callbackButton({
            label: `${notif.weekdays.includes(weekday) ? '✅' : '☐'} ${label}`,
            payload: {
              scheduleNotifAction: 'editWeekday',
              notifId: notif.id,
              weekday,
            },
          });
        }),
      ),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
          payload: {
            scheduleNotifAction: 'edit',
            notifId: notif.id,
          },
        }),
      ],
    ]);
  }

  /** Подтверждение защищает от случайного удаления настройки рассылки. */
  public getScheduleNotifDeleteConfirmation(ctx: IContext, notifId: number) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_DeleteConfirm),
          payload: {
            scheduleNotifAction: 'delete',
            notifId,
          },
          color: Keyboard.NEGATIVE_COLOR,
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_DeleteCancel),
          payload: { scheduleNotifAction: 'settings' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getScheduleNotifTargetType(
    ctx: IContext,
    params: { notifId?: number; draftId?: string },
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetGroup),
          payload: {
            scheduleNotifAction: 'targetType',
            targetType: 'group',
            ...params,
          },
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_TargetTeacher),
          payload: {
            scheduleNotifAction: 'targetType',
            targetType: 'teacher',
            ...params,
          },
        }),
      ],
      ...(params.notifId
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
                payload: {
                  scheduleNotifAction: 'edit',
                  notifId: params.notifId,
                },
              }),
            ],
          ]
        : []),
    ]);
  }

  /** Список преподавателей для цели рассылки, не изменяющий teacherId session. */
  public getScheduleNotifTeachersList(params: {
    ctx: IContext;
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
          scheduleNotifTeacherAction: 'select',
          teacherId: teacher.id,
        },
      })),
      getPagePayload: (page) => ({
        scheduleNotifTeacherAction: 'page',
        page,
      }),
      additionalButtons: [
        [
          Keyboard.callbackButton({
            label: params.ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
            payload: { scheduleNotifTeacherAction: 'cancel' },
          }),
        ],
      ],
      pagerMode: 'compact',
    });
  }

  /** Inline-отмена локального выбора группы, не запускающая глобальную отмену scene. */
  public getScheduleNotifGroupPickerCancelButton(
    ctx: IContext,
    notifId: number,
  ) {
    return Keyboard.callbackButton({
      label: ctx.i18n.t(LocalePhrase.Button_Cancel),
      payload: {
        scheduleNotifGroupAction: 'cancel',
        notifId,
      },
      color: Keyboard.SECONDARY_COLOR,
    });
  }
}
