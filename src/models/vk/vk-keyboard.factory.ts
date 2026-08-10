import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';
import type { IKeyboardProxyButton } from 'vk-io/lib/structures/keyboard/types';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import { buildScheduleNotificationPage } from '../schedule-notification/schedule-notification-keyboard.util';

type VKPaginationItem =
  | string
  | { title: string; payload: Record<string, unknown>; selected?: boolean };

type VKPaginationOptions = {
  currentPage: number;
  totalPages: number;
  items?: (VKPaginationItem | VKPaginationItem[])[];
  getPagePayload: (page: number) => Record<string, unknown>;
  additionalButtons?: IKeyboardProxyButton[][];
  pagerMode?: PaginationPagerMode;
};

type PaginationPagerMode = 'edges' | 'nearby';

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
                label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification),
                payload: {
                  phrase: LocalePhrase.Button_ScheduleNotification,
                },
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

  public getScheduleNotificationHours(
    ctx: IContext,
    page = 1,
    notificationId?: number,
  ) {
    const hours = buildScheduleNotificationPage(
      Array.from({ length: 18 }, (_, index) => index + 6),
      page,
      6,
    );
    return Keyboard.keyboard([
      ...hours.rows.map((row) =>
        row.map((hour) =>
          Keyboard.callbackButton({
            label: `${String(hour).padStart(2, '0')}:00`,
            payload: notificationId
              ? {
                  scheduleNotificationAction: 'editHour',
                  notificationId,
                  hour,
                }
              : { scheduleNotificationAction: 'hour', hour },
          }),
        ),
      ),
      ...(hours.totalPages > 1
        ? [
            [
              ...(hours.previousPage
                ? [
                    Keyboard.callbackButton({
                      label: ctx.i18n.t(
                        LocalePhrase.Button_ScheduleNotification_PreviousPage,
                      ),
                      payload: {
                        scheduleNotificationAction: notificationId
                          ? 'editHours'
                          : 'hours',
                        page: hours.previousPage,
                        ...(notificationId ? { notificationId } : {}),
                      },
                    }),
                  ]
                : []),
              Keyboard.callbackButton({
                label: `${hours.currentPage}/${hours.totalPages}`,
                payload: {},
              }),
              ...(hours.nextPage
                ? [
                    Keyboard.callbackButton({
                      label: ctx.i18n.t(
                        LocalePhrase.Button_ScheduleNotification_NextPage,
                      ),
                      payload: {
                        scheduleNotificationAction: notificationId
                          ? 'editHours'
                          : 'hours',
                        page: hours.nextPage,
                        ...(notificationId ? { notificationId } : {}),
                      },
                    }),
                  ]
                : []),
            ],
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Back),
          payload: {
            scheduleNotificationAction: notificationId ? 'edit' : 'settings',
            ...(notificationId ? { notificationId } : {}),
          },
        }),
      ],
    ]);
  }

  public getScheduleNotificationMinutes(
    ctx: IContext,
    hour: number,
    notificationId?: number,
  ) {
    return Keyboard.keyboard([
      [0, 10, 20].map((minute) =>
        Keyboard.callbackButton({
          label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          payload: notificationId
            ? {
                scheduleNotificationAction: 'editMinute',
                notificationId,
                hour,
                minute,
              }
            : { scheduleNotificationAction: 'minute', hour, minute },
        }),
      ),
      [30, 40, 50].map((minute) =>
        Keyboard.callbackButton({
          label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          payload: notificationId
            ? {
                scheduleNotificationAction: 'editMinute',
                notificationId,
                hour,
                minute,
              }
            : { scheduleNotificationAction: 'minute', hour, minute },
        }),
      ),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Back),
          payload: {
            scheduleNotificationAction: notificationId ? 'editHours' : 'hours',
            page: 1,
            ...(notificationId ? { notificationId } : {}),
          },
        }),
      ],
    ]);
  }

  public getScheduleNotificationTargetDay(
    ctx: IContext,
    hour: number,
    minute: number,
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForToday),
          payload: {
            scheduleNotificationAction: 'day',
            hour,
            minute,
            targetDayOffset: 0,
          },
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForTomorrow),
          payload: {
            scheduleNotificationAction: 'day',
            hour,
            minute,
            targetDayOffset: 1,
          },
        }),
      ],
    ]);
  }

  public getScheduleNotificationWeekdays(
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
              scheduleNotificationAction: 'weekday',
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
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Save),
          payload: {
            scheduleNotificationAction: 'save',
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
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Back),
          payload: { scheduleNotificationAction: 'minute', hour },
        }),
      ],
    ]);
  }

  public getScheduleNotificationSettings(
    ctx: IContext,
    notification?: { id: number; isEnabled: boolean },
  ) {
    const buttons = notification
      ? [
          [
            Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Edit),
              payload: {
                scheduleNotificationAction: 'edit',
                notificationId: notification.id,
              },
              color: Keyboard.PRIMARY_COLOR,
            }),
          ],
          [
            Keyboard.callbackButton({
              label: notification.isEnabled
                ? ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Disable)
                : ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Enable),
              payload: {
                scheduleNotificationAction: 'enabled',
                notificationId: notification.id,
                isEnabled: !notification.isEnabled,
              },
            }),
          ],
          [
            Keyboard.callbackButton({
              label: ctx.i18n.t(
                LocalePhrase.Button_ScheduleNotification_Delete,
              ),
              payload: {
                scheduleNotificationAction: 'delete',
                notificationId: notification.id,
              },
              color: Keyboard.NEGATIVE_COLOR,
            }),
          ],
        ]
      : [];
    if (!notification) {
      buttons.push([
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Create),
          payload: { scheduleNotificationAction: 'create' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ]);
    }
    return Keyboard.keyboard(buttons);
  }

  /** Клавиатура редактирования сохраняет каждое изменение сразу. */
  public getScheduleNotificationEditor(
    ctx: IContext,
    notification: {
      id: number;
      deliveryHour: number;
      deliveryMinute: number;
      targetDayOffset: number;
      weekdays: number[];
    },
  ) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: `Время: ${String(notification.deliveryHour).padStart(2, '0')}:${String(notification.deliveryMinute).padStart(2, '0')}`,
          payload: {
            scheduleNotificationAction: 'editHour',
            notificationId: notification.id,
          },
        }),
      ],
      [
        Keyboard.callbackButton({
          label: `Расписание: ${notification.targetDayOffset ? 'на завтра' : 'на сегодня'}`,
          payload: {
            scheduleNotificationAction: 'editDay',
            notificationId: notification.id,
            targetDayOffset: notification.targetDayOffset ? 0 : 1,
          },
        }),
      ],
      ...[0, 3, 6].map((startIndex) =>
        labels.slice(startIndex, startIndex + 3).map((label, index) => {
          const weekday = startIndex + index + 1;
          return Keyboard.callbackButton({
            label: `${notification.weekdays.includes(weekday) ? '✅' : '☐'} ${label}`,
            payload: {
              scheduleNotificationAction: 'editWeekday',
              notificationId: notification.id,
              weekday,
            },
          });
        }),
      ),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Save),
          payload: { scheduleNotificationAction: 'editSave' },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
    ]);
  }

  /** Дополнительные действия редактора выводятся отдельно из-за лимита VK в шесть рядов. */
  public getScheduleNotificationEditorActions(
    ctx: IContext,
    notificationId: number,
  ) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(
            LocalePhrase.Button_ScheduleNotification_ChangeGroup,
          ),
          payload: {
            scheduleNotificationAction: 'changeGroup',
            notificationId,
            returnToEditor: true,
          },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getScheduleNotificationGroups(
    ctx: IContext,
    notificationId: number,
    groupNames: string[],
    page: number,
    returnToEditor = false,
  ) {
    const groups = buildScheduleNotificationPage(groupNames, page, 4, 2);
    return Keyboard.keyboard([
      ...groups.rows.map((row) =>
        row.map((groupName) =>
          Keyboard.callbackButton({
            label: getVKButtonLabel(groupName),
            payload: {
              scheduleNotificationAction: 'group',
              notificationId,
              groupName,
              returnToEditor,
            },
          }),
        ),
      ),
      ...(groups.totalPages > 1
        ? [
            [
              ...(groups.previousPage
                ? [
                    Keyboard.callbackButton({
                      label: ctx.i18n.t(
                        LocalePhrase.Button_ScheduleNotification_PreviousPage,
                      ),
                      payload: {
                        scheduleNotificationAction: 'groups',
                        notificationId,
                        page: groups.previousPage,
                        returnToEditor,
                      },
                    }),
                  ]
                : []),
              Keyboard.callbackButton({
                label: `${groups.currentPage}/${groups.totalPages}`,
                payload: {},
              }),
              ...(groups.nextPage
                ? [
                    Keyboard.callbackButton({
                      label: ctx.i18n.t(
                        LocalePhrase.Button_ScheduleNotification_NextPage,
                      ),
                      payload: {
                        scheduleNotificationAction: 'groups',
                        notificationId,
                        page: groups.nextPage,
                        returnToEditor,
                      },
                    }),
                  ]
                : []),
            ],
          ]
        : []),
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Back),
          payload: {
            scheduleNotificationAction: returnToEditor ? 'edit' : 'settings',
            ...(returnToEditor ? { notificationId } : {}),
          },
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

  public getBroadcastSettings(ctx: IContext, manualMode = false) {
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
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_SelectRecipients),
          payload: { broadcastAction: 'recipients', page: 1 },
          color: Keyboard.SECONDARY_COLOR,
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
    const toButton = (page: number, label: string) =>
      Keyboard.callbackButton({
        label,
        payload: params.getPagePayload(page),
        color: Keyboard.SECONDARY_COLOR,
      });
    const noop = () => Keyboard.callbackButton({ label: '-', payload: {} });
    const { currentPage, totalPages } = params;
    const mode = params.pagerMode || 'edges';

    if (mode === 'edges') {
      return [
        currentPage > 1 ? toButton(1, '«1') : noop(),
        currentPage > 1
          ? toButton(currentPage - 1, `‹${currentPage - 1}`)
          : noop(),
        toButton(currentPage, `-${currentPage}-`),
        currentPage < totalPages
          ? toButton(currentPage + 1, `${currentPage + 1}›`)
          : noop(),
        currentPage < totalPages
          ? toButton(totalPages, `${totalPages}»`)
          : noop(),
      ];
    }

    const previousMiddle = Math.floor((1 + currentPage) / 2);
    const nextMiddle = Math.ceil((currentPage + totalPages) / 2);
    return [
      previousMiddle > 1 && previousMiddle < currentPage
        ? toButton(previousMiddle, `«${previousMiddle}`)
        : noop(),
      currentPage > 1
        ? toButton(currentPage - 1, `‹${currentPage - 1}`)
        : noop(),
      toButton(currentPage, `-${currentPage}-`),
      nextMiddle > currentPage && nextMiddle < totalPages
        ? toButton(nextMiddle, `${nextMiddle}»`)
        : noop(),
      currentPage < totalPages
        ? toButton(currentPage + 1, `${currentPage + 1}›`)
        : noop(),
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
    return Keyboard.keyboard([]).oneTime();
  }
}
