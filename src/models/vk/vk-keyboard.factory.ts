import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';
import type { IKeyboardProxyButton } from 'vk-io/lib/structures/keyboard/types';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import { FeedbackCategory } from '../feedback/feedback.types';
import { buildScheduleNotifPage } from '../schedule-notif/schedule-notif-keyboard.util';
import {
  getScheduleNotifTargetPhrase,
  SCHEDULE_NOTIFICATION_MINUTES,
} from '../schedule-notif/schedule-notif-ui.util';
import {
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
} from '../schedule-notif/schedule-notif.types';
import type { ScheduleWeekView } from '../schedule/schedule.service';
import { getWebsiteUrl } from '../schedule/util/schedule-calendar-link.util';

export type VKPaginationItem =
  | string
  | { title: string; payload: Record<string, unknown>; selected?: boolean };

export type VKPaginationOptions = {
  currentPage: number;
  totalPages: number;
  items?: (VKPaginationItem | VKPaginationItem[])[];
  getPagePayload: (page: number) => Record<string, unknown>;
  additionalButtons?: IKeyboardProxyButton[][];
  /** @default 'edges' */
  pagerMode?: PaginationPagerMode;
};

type PaginationPagerMode = 'compact' | 'compact-pages' | 'edges' | 'nearby';

const VK_BUTTON_LABEL_MAX_LENGTH = 40;
const VK_INLINE_KEYBOARD_MAX_ROWS = 6;
const VK_INLINE_KEYBOARD_MAX_COLUMNS = 4;
// Фактический лимит VK API для inline callback-клавиатур
const VK_INLINE_KEYBOARD_MAX_BUTTONS = 10;

/** Возвращает подпись, совместимую с лимитом VK в 40 символов. */
export const getVKButtonLabel = (label: string) =>
  label.length > VK_BUTTON_LABEL_MAX_LENGTH
    ? `${label.slice(0, VK_BUTTON_LABEL_MAX_LENGTH - 2)}..`
    : label;

@Injectable()
export class VKKeyboardFactory {
  public needInline(ctx: IContext) {
    return ctx.isChat && ctx.sessionConversation.hideStaticKeyboard !== false;
  }

  public getStart(ctx: IContext) {
    const isAdmin =
      xEnv.SOCIAL_VK_ADMIN_IDS.includes(ctx.senderId || ctx.peerId) ||
      ctx.state.user?.role === 'admin';

    const hasGroup = !!ctx.state.userSocial?.groupName;
    const hasTeacher = !!ctx.session.teacherId;
    const webViewUrl = getWebsiteUrl(xEnv.SOCIAL_VK_WEB_VIEW_URL);

    return Keyboard.keyboard([
      ...(hasGroup
        ? [
            [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule),
                payload: { phrase: LocalePhrase.Button_Schedule_Schedule },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : ctx.isDM
          ? [
              [
                Keyboard.textButton({
                  label: ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                  payload: { phrase: LocalePhrase.Button_SelectGroup },
                  color: Keyboard.SECONDARY_COLOR,
                }),
              ],
            ]
          : []),
      ...(ctx.isDM && !hasTeacher
        ? [
            [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_Schedule_Teacher),
                payload: { phrase: LocalePhrase.Button_Schedule_Teacher },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : ctx.isDM && hasTeacher
          ? [
              [
                Keyboard.textButton({
                  label: ctx.i18n.t(LocalePhrase.Button_Schedule_MyTeacher),
                  payload: { phrase: LocalePhrase.Button_Schedule_MyTeacher },
                  color: Keyboard.SECONDARY_COLOR,
                }),
              ],
            ]
          : []),
      ...(ctx.isDM
        ? [
            ...(ctx.state.user
              ? [
                  [
                    Keyboard.textButton({
                      label: ctx.i18n.t(LocalePhrase.Button_Profile),
                      payload: { phrase: LocalePhrase.Button_Profile },
                      color: Keyboard.SECONDARY_COLOR,
                    }),
                  ],
                ]
              : []),
            [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif),
                payload: {
                  phrase: LocalePhrase.Button_ScheduleNotif,
                },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
            [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_Calendar),
                payload: { phrase: LocalePhrase.Button_Calendar },
                color: Keyboard.SECONDARY_COLOR,
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
          ]
        : []),
      ...(ctx.isDM
        ? [
            [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_Feedback),
                payload: { phrase: LocalePhrase.Button_Feedback },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : []),
      ...(!ctx.isDM
        ? [
            [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif),
                payload: { phrase: LocalePhrase.Button_ScheduleNotif },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : []),
      [
        ...(ctx.isDM && isAdmin
          ? [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_Broadcast),
                payload: { command: 'broadcast' },
                color: Keyboard.PRIMARY_COLOR,
              }),
            ]
          : []),
      ],
    ]);
  }

  public getInviteToChat(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.applicationButton({
          label: ctx.i18n.t(LocalePhrase.Button_InviteToChat),
          appId: 6441755,
          ownerId: -ctx.$groupId!,
        }),
      ],
    ]);
  }

  /** Inline-кнопка справки для ответа на нераспознанное сообщение. */
  public getUnknownMessageHelp(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Help),
          payload: { mainAction: 'help' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]).inline();
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

  /** Inline-клавиатура категории пользовательского отзыва. */
  public getFeedbackCategories(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategorySchedule),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Schedule,
          },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategoryBot),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Bot,
          },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategorySuggestion),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Suggestion,
          },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_CategoryOther),
          payload: {
            feedbackAction: 'category',
            category: FeedbackCategory.Other,
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { feedbackAction: 'cancel' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]).inline();
  }

  /** Inline-клавиатура для завершения сбора текста и вложений. */
  public getFeedbackCollector(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Feedback_Submit),
          payload: { feedbackAction: 'submit' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { feedbackAction: 'cancel' },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
    ]).inline();
  }

  /** Быстрые действия из приветственной карточки личного чата. */
  public getWelcomeFeatures(ctx: IContext) {
    const webViewUrl = getWebsiteUrl(xEnv.SOCIAL_VK_WEB_VIEW_URL);

    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Welcome_SelectGroup),
          payload: { phrase: LocalePhrase.Button_SelectGroup },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Welcome_ScheduleNotif),
          payload: { phrase: LocalePhrase.Button_ScheduleNotif },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Welcome_Guide),
          payload: { mainAction: 'help' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Calendar),
          payload: { phrase: LocalePhrase.Button_Calendar },
          color: Keyboard.PRIMARY_COLOR,
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
      [
        Keyboard.applicationButton({
          label: ctx.i18n.t(LocalePhrase.Button_InviteToChat),
          appId: 6441755,
          ownerId: -ctx.$groupId!,
        }),
      ],
    ]);
  }

  public getScheduleNotifHours(ctx: IContext, page = 1, notifId?: number) {
    const hours = buildScheduleNotifPage(
      Array.from({ length: 18 }, (_, index) => index + 6),
      page,
      6,
    );
    return this.getPagination({
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
    return this.getPagination({
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
    return this.getPagination({
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

  /** Постраничный список преподавателей для выбора расписания. */
  public getTeachersList(params: {
    ctx: IContext;
    listId: string;
    items: { id: number; name: string }[];
    currentPage: number;
    totalPages: number;
  }) {
    return this.getPagination({
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

  /** Собирает VK pagination из item-рядов, pager и дополнительных кнопок. */
  public getPagination(params: VKPaginationOptions) {
    const itemRows = this.getPaginationBuild(params);
    const pagerRow = this.getPaginationPager(params);
    const rows = [...itemRows, pagerRow, ...(params.additionalButtons || [])];
    const buttonsCount = rows.reduce((count, row) => count + row.length, 0);

    if (rows.length > VK_INLINE_KEYBOARD_MAX_ROWS) {
      throw new RangeError(
        `VK pagination exceeds ${VK_INLINE_KEYBOARD_MAX_ROWS} rows`,
      );
    }
    if (buttonsCount > VK_INLINE_KEYBOARD_MAX_BUTTONS) {
      throw new RangeError(
        `VK inline pagination exceeds ${VK_INLINE_KEYBOARD_MAX_BUTTONS} buttons`,
      );
    }
    return Keyboard.keyboard(rows);
  }

  /** Строит item-ряды с учётом ограничений VK на кнопки, строки и колонки. */
  public getPaginationBuild(params: VKPaginationOptions) {
    const additionalButtons = params.additionalButtons || [];
    // VK позволяет максимум шесть рядов, один из них всегда занят pager.
    const maxItemsRows = Math.max(
      0,
      VK_INLINE_KEYBOARD_MAX_ROWS - 1 - additionalButtons.length,
    );
    const itemRows = params.items || [];
    if (itemRows.length > maxItemsRows) {
      throw new RangeError(
        `VK pagination exceeds ${maxItemsRows} item rows: ${itemRows.length}`,
      );
    }

    return itemRows.map((itemOrRow) => {
      const row = Array.isArray(itemOrRow) ? itemOrRow : [itemOrRow];
      if (row.length > VK_INLINE_KEYBOARD_MAX_COLUMNS) {
        throw new RangeError(
          `VK pagination row exceeds ${VK_INLINE_KEYBOARD_MAX_COLUMNS} buttons`,
        );
      }

      return row.map((item) => {
        const title = typeof item === 'string' ? item : item.title;
        const payload = typeof item === 'string' ? {} : item.payload;
        const selected = typeof item === 'string' ? false : item.selected;

        return Keyboard.callbackButton({
          label: getVKButtonLabel(title),
          payload,
          color: selected ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR,
        });
      });
    });
  }

  /** Строит ряд навигации текущей страницы для VK callback-клавиатуры. */
  public getPaginationPager(params: VKPaginationOptions) {
    const toBtn = (page: number, label: string) =>
      Keyboard.callbackButton({
        label,
        payload: params.getPagePayload(page),
        color: Keyboard.SECONDARY_COLOR,
      });
    const noop = () =>
      Keyboard.callbackButton({ label: '-', payload: { nope: {} } });
    const { currentPage: curPage, totalPages } = params;
    const mode = params.pagerMode || 'edges';

    if (mode === 'compact' || mode === 'compact-pages') {
      return [
        curPage > 1 ? toBtn(curPage - 1, '‹') : noop(),
        toBtn(
          curPage,
          mode === 'compact-pages'
            ? `-${curPage}/${totalPages}-`
            : `-${curPage}-`,
        ),
        curPage < totalPages ? toBtn(curPage + 1, '›') : noop(),
      ];
    }

    if (mode === 'edges') {
      return [
        curPage > 1 ? toBtn(1, '«1') : noop(),
        curPage > 1 ? toBtn(curPage - 1, `‹${curPage - 1}`) : noop(),
        toBtn(curPage, `-${curPage}-`),
        curPage < totalPages ? toBtn(curPage + 1, `${curPage + 1}›`) : noop(),
        curPage < totalPages ? toBtn(totalPages, `${totalPages}»`) : noop(),
      ];
    }

    const previousMiddle = Math.floor((1 + curPage) / 2);
    const nextMiddle = Math.ceil((curPage + totalPages) / 2);
    return [
      previousMiddle > 1 && previousMiddle < curPage
        ? toBtn(previousMiddle, `«${previousMiddle}`)
        : noop(),
      curPage > 1 ? toBtn(curPage - 1, `‹${curPage - 1}`) : noop(),
      toBtn(curPage, `-${curPage}-`),
      nextMiddle > curPage && nextMiddle < totalPages
        ? toBtn(nextMiddle, `${nextMiddle}»`)
        : noop(),
      curPage < totalPages ? toBtn(curPage + 1, `${curPage + 1}›`) : noop(),
    ];
  }

  /** Клавиатура сцены выбора группы: ввод вручную или переход к институтам. */
  public getSelectGroupScene(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
          payload: { groupAction: 'institutes' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { phrase: LocalePhrase.Button_Cancel },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  /** Кнопка возврата из списка групп к списку институтов. */
  public getInstitutesListButton(
    ctx: IContext,
    payload: Record<string, unknown> = { groupAction: 'institutes' },
  ) {
    return Keyboard.callbackButton({
      label: ctx.i18n.t(LocalePhrase.Button_Groups_ChangeInstitute),
      payload,
      color: Keyboard.PRIMARY_COLOR,
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

  public getAuth(
    ctx: IContext,
    social = true,
    addSelectGroup = false,
    addCancel = true,
  ) {
    const phrase = social
      ? LocalePhrase.Button_AuthLink_SocialConnect
      : LocalePhrase.Button_AuthLink;
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(phrase),
          color: Keyboard.SECONDARY_COLOR,
          payload: { phrase },
        }),
      ],
      ...(addSelectGroup
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                payload: { phrase: LocalePhrase.Button_SelectGroup },
                color: Keyboard.POSITIVE_COLOR,
              }),
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Schedule_Teacher),
                payload: {
                  phrase: LocalePhrase.Button_Schedule_Teacher,
                },
                color: Keyboard.POSITIVE_COLOR,
              }),
            ],
          ]
        : []),
      ...(addCancel
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Cancel),
                payload: { phrase: LocalePhrase.Button_Cancel },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : []),
    ]);
  }

  public getSelectGroup(ctx: IContext, groupName?: string) {
    return Keyboard.keyboard([
      [
        groupName
          ? Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_SelectGroup_X, {
                groupName,
              }),
              payload: { phrase: LocalePhrase.Button_SelectGroup, groupName },
              color: Keyboard.POSITIVE_COLOR,
            })
          : Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_SelectGroup),
              payload: { phrase: LocalePhrase.Button_SelectGroup },
              color: Keyboard.POSITIVE_COLOR,
            }),
      ],
    ]);
  }

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

  public getCancel(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { phrase: LocalePhrase.Button_Cancel },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getClose(ctx?: IContext) {
    void ctx;
    return Keyboard.keyboard([]).oneTime();
  }
}
