import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';
import type { IKeyboardProxyButton } from 'vk-io/lib/structures/keyboard/types';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import {
  BroadcastActionKeyboard,
  BroadcastFeedbackButton,
} from '../broadcast/broadcast.types';
import { buildScheduleNotifPage } from '../schedule-notif/schedule-notif-keyboard.util';
import { SCHEDULE_NOTIFICATION_MINUTES } from '../schedule-notif/schedule-notif-ui.util';

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
const getVKButtonLabel = (label: string) =>
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
            [
              ...(ctx.state.user
                ? [
                    Keyboard.textButton({
                      label: ctx.i18n.t(LocalePhrase.Button_Profile),
                      payload: { phrase: LocalePhrase.Button_Profile },
                      color: Keyboard.SECONDARY_COLOR,
                    }),
                  ]
                : []),
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif),
                payload: {
                  phrase: LocalePhrase.Button_ScheduleNotif,
                },
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

  public getBroadcastQueueControls(ctx: IContext, paused = true) {
    return Keyboard.keyboard([
      [
        paused
          ? Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Resume),
              payload: { broadcastAction: 'resume' },
              color: Keyboard.POSITIVE_COLOR,
            })
          : Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Pause),
              payload: { broadcastAction: 'pause' },
              color: Keyboard.SECONDARY_COLOR,
            }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Terminate),
          payload: { broadcastAction: 'terminate' },
          color: Keyboard.NEGATIVE_COLOR,
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

  public getScheduleNotifTargetDay(
    ctx: IContext,
    hour: number,
    minute: number,
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForToday),
          payload: {
            scheduleNotifAction: 'day',
            hour,
            minute,
            targetDayOffset: 0,
          },
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForTomorrow),
          payload: {
            scheduleNotifAction: 'day',
            hour,
            minute,
            targetDayOffset: 1,
          },
        }),
      ],
    ]);
  }

  public getScheduleNotifWeekdays(
    ctx: IContext,
    hour: number,
    minute: number,
    targetDayOffset: number,
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
    notif?: { id: number; isEnabled: boolean },
  ) {
    const buttons = notif
      ? [
          [
            Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Edit),
              payload: {
                scheduleNotifAction: 'edit',
                notifId: notif.id,
              },
              color: Keyboard.PRIMARY_COLOR,
            }),
          ],
          [
            Keyboard.callbackButton({
              label: notif.isEnabled
                ? ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Disable)
                : ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Enable),
              payload: {
                scheduleNotifAction: 'enabled',
                notifId: notif.id,
                isEnabled: !notif.isEnabled,
              },
            }),
          ],
          [
            Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Delete),
              payload: {
                scheduleNotifAction: 'deleteConfirm',
                notifId: notif.id,
              },
              color: Keyboard.NEGATIVE_COLOR,
            }),
          ],
        ]
      : [];
    if (!notif) {
      buttons.push([
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Create),
          payload: { scheduleNotifAction: 'create' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ]);
    }
    return Keyboard.keyboard(buttons);
  }

  /** Клавиатура редактирования сохраняет каждое изменение сразу. */
  public getScheduleNotifEditor(
    ctx: IContext,
    notif: {
      id: number;
      deliveryHour: number;
      deliveryMinute: number;
      targetDayOffset: number;
      weekdays: number[];
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
            `Расписание: ${notif.targetDayOffset ? 'на завтра' : 'на сегодня'}`,
          ),
          payload: {
            scheduleNotifAction: 'editDay',
            notifId: notif.id,
            targetDayOffset: notif.targetDayOffset ? 0 : 1,
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
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_ChangeGroup),
          ),
          payload: {
            scheduleNotifAction: 'changeGroup',
            notifId: notif.id,
          },
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Done),
          ),
          payload: { scheduleNotifAction: 'editSave' },
          color: Keyboard.POSITIVE_COLOR,
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

  public getBroadcastMenu(ctx: IContext, hasCurrent = false) {
    return this.getActioner(ctx, [
      [
        {
          title: ctx.i18n.t(LocalePhrase.Button_Broadcast_Create),
          payload: { broadcastAction: 'menuCreate' },
          color: Keyboard.POSITIVE_COLOR,
        },
      ],
      [
        {
          title: ctx.i18n.t(LocalePhrase.Button_Broadcast_Status),
          payload: { broadcastAction: 'menuStatus' },
        },
        ...(hasCurrent
          ? [
              {
                title: ctx.i18n.t(LocalePhrase.Button_Broadcast_Current),
                payload: { broadcastAction: 'menuCurrent' },
              },
            ]
          : []),
      ],
      [
        {
          title: ctx.i18n.t(LocalePhrase.Button_Broadcast_List),
          payload: { broadcastAction: 'menuList' },
        },
      ],
    ]);
  }

  public getBroadcastCampaignsList(
    ctx: IContext,
    items: { id: number; status: string }[],
  ) {
    return this.getActioner(ctx, [
      ...items.map((item) => [
        {
          title: `№${item.id} • ${item.status}`,
          payload: { broadcastAction: 'detail', campaignId: item.id },
        },
      ]),
      [
        {
          title: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToMenu),
          payload: { broadcastAction: 'menuPanel' },
        },
      ],
    ]);
  }

  public getBroadcastCampaignDetails(
    ctx: IContext,
    params: { campaignId: number; active: boolean; paused: boolean },
  ) {
    return Keyboard.keyboard([
      ...(params.active
        ? [
            [
              params.paused
                ? Keyboard.callbackButton({
                    label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Resume),
                    payload: { broadcastAction: 'resume' },
                    color: Keyboard.POSITIVE_COLOR,
                  })
                : Keyboard.callbackButton({
                    label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Pause),
                    payload: { broadcastAction: 'pause' },
                    color: Keyboard.SECONDARY_COLOR,
                  }),
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Terminate),
                payload: { broadcastAction: 'terminate' },
                color: Keyboard.NEGATIVE_COLOR,
              }),
            ],
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ApplySettings),
          payload: {
            broadcastAction: 'applySettings',
            campaignId: params.campaignId,
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Delete),
          payload: {
            broadcastAction: 'delete',
            campaignId: params.campaignId,
          },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToList),
          payload: { broadcastAction: 'menuList' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastCampaignDeleteConfirmation(
    ctx: IContext,
    campaignId: number,
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_DeleteAll),
          payload: { broadcastAction: 'deleteAll', campaignId },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_DeleteSelect),
          payload: { broadcastAction: 'deleteSelect', campaignId, page: 1 },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          payload: { broadcastAction: 'detail', campaignId },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastFeedbackButton(
    text: string,
    deliveryId: number,
    action: 'initial' | 'repeat' = 'initial',
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: text,
          payload: {
            broadcastFeedbackAction: action,
            deliveryId,
          },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
    ]);
  }

  /** Собирает action- и feedback-ряды в пределах лимитов VK inline-клавиатуры. */
  public getBroadcastRecipientKeyboard(params: {
    actionKeyboard?: BroadcastActionKeyboard | null;
    feedbackButton?: BroadcastFeedbackButton | null;
    feedbackAction?: 'initial' | 'repeat';
    deliveryId: number;
  }) {
    const rows: IKeyboardProxyButton[][] = [];
    for (const actionButton of params.actionKeyboard || []) {
      rows.push([
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            actionButton.text ||
              (actionButton.type === 'auth'
                ? 'Подключить или обновить ЯГТУ.ID'
                : 'Выбрать актуальную группу'),
          ),
          payload: {
            broadcastRecipientAction: actionButton.type,
            deliveryId: params.deliveryId,
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ]);
    }
    if (params.feedbackButton) {
      rows.push([
        Keyboard.callbackButton({
          label: getVKButtonLabel(params.feedbackButton.text),
          payload: {
            broadcastFeedbackAction: params.feedbackAction || 'initial',
            deliveryId: params.deliveryId,
          },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ]);
    }
    return Keyboard.keyboard(rows);
  }

  /** На VK три доставки на странице: pager и две кнопки действий занимают ещё пять мест. */
  public getBroadcastCampaignDeleteSelector(params: {
    ctx: IContext;
    campaignId: number;
    items: { id: number; title: string; selected: boolean }[];
    currentPage: number;
    totalPages: number;
    selectedCount: number;
  }) {
    return this.getPagination({
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: item.title,
        payload: {
          broadcastAction: 'deleteToggle',
          campaignId: params.campaignId,
          page: params.currentPage,
          deliveryId: item.id,
        },
        selected: item.selected,
      })),
      getPagePayload: (page) => ({
        broadcastAction: 'deleteSelect',
        campaignId: params.campaignId,
        page,
      }),
      additionalButtons: [
        [
          Keyboard.callbackButton({
            label: params.ctx.i18n.t(
              LocalePhrase.Button_Broadcast_DeleteSelected,
              { selectedCount: params.selectedCount },
            ),
            payload: {
              broadcastAction: 'deleteSelected',
              campaignId: params.campaignId,
              page: params.currentPage,
            },
            color: Keyboard.NEGATIVE_COLOR,
          }),
        ],
        [
          Keyboard.callbackButton({
            label: params.ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
            payload: {
              broadcastAction: 'detail',
              campaignId: params.campaignId,
            },
            color: Keyboard.SECONDARY_COLOR,
          }),
        ],
      ],
      pagerMode: 'compact',
    });
  }

  public getActioner(
    ctx: IContext,
    items?:
      | {
          title: string;
          payload: Record<string, unknown>;
          color?: string;
        }[]
      | {
          title: string;
          payload: Record<string, unknown>;
          color?: string;
        }[][],
  ) {
    const rows = (items || []).map((itemOrRow) => {
      const row = Array.isArray(itemOrRow) ? itemOrRow : [itemOrRow];
      return row.map((item) =>
        Keyboard.callbackButton({
          label: item.title,
          payload: item.payload,
          color: item.color || Keyboard.SECONDARY_COLOR,
        }),
      );
    });

    return Keyboard.keyboard(rows);
  }

  public getBroadcastConfirm(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_CreateQueue),
          payload: { broadcastAction: 'create' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          payload: { broadcastAction: 'backToSettings' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastSettings(
    ctx: IContext,
    options: {
      manualMode?: boolean;
      onlyAuthorized?: boolean;
      groupName?: string | null;
      feedbackButton?: { text: string } | null;
      actionKeyboard?: BroadcastActionKeyboard | null;
    } = {},
  ) {
    const {
      manualMode = false,
      onlyAuthorized = false,
      groupName = null,
      feedbackButton = null,
      actionKeyboard = [],
    } = options;

    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(
            manualMode
              ? LocalePhrase.Button_Broadcast_AudienceAll
              : LocalePhrase.Button_Broadcast_AudienceManual,
          ),
          payload: {
            broadcastAction: manualMode ? 'audienceAll' : 'audienceManual',
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionButtons, {
            actionButtonsCount: actionKeyboard?.length || 0,
          }),
          payload: { broadcastAction: 'actionSettings' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      ...(manualMode
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_SelectRecipients,
                ),
                payload: { broadcastAction: 'recipients', page: 1 },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_EditFilters, {
            onlyAuthorized,
            groupName: groupName || '-',
          }),
          payload: { broadcastAction: 'filters' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackToggle, {
            feedbackButton,
          }),
          payload: { broadcastAction: 'feedbackSettings' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Continue),
          payload: { broadcastAction: 'continue' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
    ]);
  }

  /** Экран настройки fallback не перегружает основное меню рассылки. */
  public getBroadcastFeedbackSettings(
    ctx: IContext,
    feedbackButton?: {
      text: string;
      afterClickText?: string | null;
    } | null,
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackToggle, {
            feedbackButton,
          }),
          payload: { broadcastAction: 'feedbackToggle' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      ...(feedbackButton
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackText),
                payload: { broadcastAction: 'feedbackText' },
                color: Keyboard.SECONDARY_COLOR,
              }),
              Keyboard.callbackButton({
                label: ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_FeedbackResponse,
                ),
                payload: { broadcastAction: 'feedbackResponse' },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_FeedbackAfterToggle,
                  { feedbackAfterClickText: feedbackButton.afterClickText },
                ),
                payload: { broadcastAction: 'feedbackAfterToggle' },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
            ...(feedbackButton.afterClickText
              ? [
                  [
                    Keyboard.callbackButton({
                      label: ctx.i18n.t(
                        LocalePhrase.Button_Broadcast_FeedbackAfterText,
                      ),
                      payload: { broadcastAction: 'feedbackAfterText' },
                      color: Keyboard.SECONDARY_COLOR,
                    }),
                  ],
                ]
              : []),
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          payload: { broadcastAction: 'feedbackBack' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  /** Экран набора дополнительных кнопок получателя. */
  public getBroadcastActionSettings(
    ctx: IContext,
    actionKeyboard: BroadcastActionKeyboard = [],
  ) {
    const getAction = (type: BroadcastActionKeyboard[number]['type']) =>
      actionKeyboard.find((item) => item.type === type);
    const selectGroup = getAction('select_group');
    const auth = getAction('auth');

    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionSelectGroup, {
            actionButton: selectGroup,
          }),
          payload: { broadcastAction: 'actionSelectGroupToggle' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      ...(selectGroup
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionText),
                payload: { broadcastAction: 'actionSelectGroupText' },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionAuth, {
            actionButton: auth,
          }),
          payload: { broadcastAction: 'actionAuthToggle' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      ...(auth
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionText),
                payload: { broadcastAction: 'actionAuthText' },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          payload: { broadcastAction: 'actionBack' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastActivityFilterMenu(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: 'Был активен до даты',
          payload: { broadcastAction: 'filterActivityBefore' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: 'Был активен в диапазоне',
          payload: { broadcastAction: 'filterActivityRange' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsClear),
          payload: { broadcastAction: 'filterActivityClear' },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          payload: { broadcastAction: 'filters' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastActionTextPrompt(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          payload: { broadcastAction: 'actionSettings' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  /** VK: четыре кампании, pager и кнопка «Готово» укладываются в лимит 10 кнопок. */
  public getBroadcastExcludeCampaignsSelector(params: {
    ctx: IContext;
    items: { id: number; title: string; selected: boolean }[];
    currentPage: number;
    totalPages: number;
    selectedCount: number;
  }) {
    return this.getPagination({
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: item.title,
        payload: {
          broadcastAction: 'filterExcludeCampaignToggle',
          campaignId: item.id,
          page: params.currentPage,
        },
        selected: item.selected,
      })),
      getPagePayload: (page) => ({
        broadcastAction: 'filterExcludeCampaigns',
        page,
      }),
      additionalButtons: [
        [
          Keyboard.callbackButton({
            label: params.ctx.i18n.t(
              LocalePhrase.Button_Broadcast_FilterExcludeCampaignsDone,
              { selectedCount: params.selectedCount },
            ),
            payload: { broadcastAction: 'filterExcludeCampaignDone' },
            color: Keyboard.POSITIVE_COLOR,
          }),
        ],
      ],
      pagerMode: 'compact',
    });
  }

  public getBroadcastFilters(
    ctx: IContext,
    params: {
      hasGroups: boolean;
      onlyAuthorized?: boolean;
      hasActivityFilter: boolean;
      hasExcludedCampaigns: boolean;
    },
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterAuthorized,
            params,
          ),
          payload: { broadcastAction: 'filterAuthorized' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterActivity,
            params,
          ),
          payload: { broadcastAction: 'filterActivity' },
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterExcludeCampaigns,
            params,
          ),
          payload: { broadcastAction: 'filterExcludeCampaigns' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroups, params),
          payload: { broadcastAction: 'filterGroups' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      ...(params.hasGroups
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_FilterGroupsShow,
                ),
                payload: { broadcastAction: 'filterGroupsShow' },
                color: Keyboard.SECONDARY_COLOR,
              }),
              Keyboard.callbackButton({
                label: ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_FilterGroupsClear,
                ),
                payload: { broadcastAction: 'filterGroupsClear' },
                color: Keyboard.NEGATIVE_COLOR,
              }),
            ],
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          payload: { broadcastAction: 'backToSettings' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastGroupFilterMenu(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterGroupsInstitutes,
          ),
          payload: { broadcastAction: 'filterInstitutes', page: 1 },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsText),
          payload: { broadcastAction: 'filterGroupsText' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          payload: { broadcastAction: 'filters' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  /** Клавиатура остаётся рядом с подсказкой, пока администратор вводит список групп. */
  public getBroadcastGroupFilterTextPrompt(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsShow),
          payload: { broadcastAction: 'filterGroupsTextShow' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterGroupsTextCancel,
          ),
          payload: { broadcastAction: 'filterGroupsTextCancel' },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastFilterTextPrompt(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterTextCancel),
          payload: { broadcastAction: 'filterTextCancel' },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastFeedbackTextPrompt(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          payload: { broadcastAction: 'feedbackSettings' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastRecipients(params: {
    ctx: IContext;
    items: { id: number; title: string; selected: boolean }[];
    currentPage: number;
    totalPages: number;
  }) {
    return this.getPagination({
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: `${item.selected ? '✅ ' : '⬜ '} ${item.title}`,
        payload: { broadcastAction: 'toggleRecipient', id: item.id },
        selected: item.selected,
      })),
      getPagePayload: (page) => ({ broadcastAction: 'recipients', page }),
      additionalButtons: [
        [
          Keyboard.callbackButton({
            label: params.ctx.i18n.t(
              LocalePhrase.Button_Broadcast_BackToSettings,
            ),
            payload: { broadcastAction: 'backToSettings' },
            color: Keyboard.PRIMARY_COLOR,
          }),
        ],
      ],
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
  ) {
    const payload = (phrase: LocalePhrase) => ({
      phrase,
      ...(target.type === 'teacher'
        ? { teacherId: target.id }
        : { groupName: target.id }),
    });

    return Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForToday),
          payload: payload(LocalePhrase.Button_Schedule_ForToday),
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForTomorrow),
          payload: payload(LocalePhrase.Button_Schedule_ForTomorrow),
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForWeek),
          payload: payload(LocalePhrase.Button_Schedule_ForWeek),
          color: Keyboard.PRIMARY_COLOR,
        }),
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForNextWeek),
          payload: payload(LocalePhrase.Button_Schedule_ForNextWeek),
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
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
