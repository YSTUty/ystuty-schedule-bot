import { Injectable } from '@nestjs/common';

import { Markup } from 'telegraf';
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from 'telegraf/typings/core/types/typegram';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { buildScheduleNotifPage } from '../schedule-notif/schedule-notif-keyboard.util';
import { SCHEDULE_NOTIFICATION_MINUTES } from '../schedule-notif/schedule-notif-ui.util';

type Hideable<B> = B & { hide?: boolean };
export type PaginationItemType =
  | string
  | { title: string; suffix?: string; payload: string };

export type TelegramPaginationOptions<
  T extends PaginationItemType = PaginationItemType,
> = {
  name: string;
  currentPage: number;
  totalPages: number;
  items?: (T | T[])[];
  actionPrefix?: string;
  additionalButtons?:
    | Hideable<InlineKeyboardButton>[]
    | Hideable<InlineKeyboardButton>[][];
  columnizer?: boolean | number;
  sortByLength?: boolean;
  pagerMode?: PaginationPagerMode;
  hidePager?: boolean;
};

type PaginationPagerMode = 'edges' | 'nearby';

@Injectable()
export class TelegramKeyboardFactory {
  public getStart(ctx: IContext) {
    const isAdmin =
      !!ctx.from &&
      (xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id) ||
        ctx.user?.role === 'admin');

    const isPrivate = ctx.chat?.type === 'private';
    const hasGroup = !!ctx.userSocial?.groupName;
    const hasTeacher = !!ctx.session.teacherId;

    return Markup.keyboard([
      ...(hasGroup
        ? [[ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule)]]
        : isPrivate
          ? [[ctx.i18n.t(LocalePhrase.Button_SelectGroup)]]
          : [[ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule)]]),
      ...(isPrivate && !hasTeacher
        ? [[ctx.i18n.t(LocalePhrase.Button_Schedule_Teacher)]]
        : isPrivate && hasTeacher
          ? [[ctx.i18n.t(LocalePhrase.Button_Schedule_MyTeacher)]]
          : []),
      ...(isPrivate
        ? [
            [
              ...(ctx.user ? [ctx.i18n.t(LocalePhrase.Button_Profile)] : []),
              ctx.i18n.t(LocalePhrase.Button_ScheduleNotif),
            ],
          ]
        : []),
      ...(!isPrivate ? [[ctx.i18n.t(LocalePhrase.Button_ScheduleNotif)]] : []),
      ...(isPrivate && isAdmin
        ? [[ctx.i18n.t(LocalePhrase.Button_Broadcast)]]
        : []),
    ]).resize();
  }

  public getBroadcastQueueControls(ctx: IContext, paused = true) {
    return Markup.inlineKeyboard([
      [
        paused
          ? Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_Broadcast_Resume),
              'broadcast:queue:resume',
            )
          : Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_Broadcast_Pause),
              'broadcast:queue:pause',
            ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Terminate),
          'broadcast:queue:terminate',
        ),
      ],
    ]);
  }

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

  public getScheduleNotifTargetDay(
    ctx: IContext,
    hour: number,
    minute: number,
  ) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Schedule_ForToday),
          `scheduleNotif:day:${hour}:${minute}:0`,
        ),
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Schedule_ForTomorrow),
          `scheduleNotif:day:${hour}:${minute}:1`,
        ),
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
    return Markup.inlineKeyboard([
      ...[0, 3, 6].map((startIndex) =>
        labels.slice(startIndex, startIndex + 3).map((label, index) => {
          const weekday = startIndex + index + 1;
          return Markup.button.callback(
            `${weekdays.includes(weekday) ? '✅' : '☐'} ${label}`,
            `scheduleNotif:weekday:${hour}:${minute}:${targetDayOffset}:${weekday}:${weekdays.join(',')}`,
          );
        }),
      ),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Done),
          `scheduleNotif:save:${hour}:${minute}:${targetDayOffset}:${weekdays.join(',')}`,
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
    notif?: { id: number; isEnabled: boolean },
  ) {
    return Markup.inlineKeyboard(
      notif
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Edit),
                `scheduleNotif:edit:${notif.id}`,
              ),
            ],
            [
              Markup.button.callback(
                notif.isEnabled
                  ? ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Disable)
                  : ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Enable),
                `scheduleNotif:enabled:${notif.id}:${notif.isEnabled ? '0' : '1'}`,
              ),
            ],
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Delete),
                `scheduleNotif:deleteConfirm:${notif.id}`,
              ),
            ],
          ]
        : [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Create),
                'scheduleNotif:create',
              ),
            ],
          ],
    );
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
          `Расписание: ${notif.targetDayOffset ? 'на завтра' : 'на сегодня'}`,
          `scheduleNotif:editDay:${notif.id}:${notif.targetDayOffset ? 0 : 1}`,
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
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_ChangeGroup),
          `scheduleNotif:changeGroup:${notif.id}:1:edit`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Done),
          'scheduleNotif:editSave',
        ),
      ],
    ]);
  }

  /** Подтверждение защищает от случайного удаления настройки рассылки. */
  public getScheduleNotifDeleteConfirmation(ctx: IContext, notifId: number) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_DeleteConfirm),
          `scheduleNotif:delete:${notifId}`,
        ),
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_DeleteCancel),
          'scheduleNotif:settings',
        ),
      ],
    ]);
  }

  public getBroadcastMenu(ctx: IContext, hasCurrent = false) {
    return this.getActioner(
      ctx,
      [
        [
          {
            title: ctx.i18n.t(LocalePhrase.Button_Broadcast_Create),
            payload: 'create',
          },
        ],
        [
          {
            title: ctx.i18n.t(LocalePhrase.Button_Broadcast_Status),
            payload: 'status',
          },
          ...(hasCurrent
            ? [
                {
                  title: ctx.i18n.t(LocalePhrase.Button_Broadcast_Current),
                  payload: 'current',
                },
              ]
            : []),
        ],
        [
          {
            title: ctx.i18n.t(LocalePhrase.Button_Broadcast_List),
            payload: 'list',
          },
        ],
      ],
      'broadcast:menu:',
    );
  }

  public getBroadcastCampaignsList(
    ctx: IContext,
    items: { id: number; status: string }[],
  ) {
    return Markup.inlineKeyboard([
      ...items.map((item) => [
        Markup.button.callback(
          `№${item.id} • ${item.status}`,
          `broadcast:campaign:detail:${item.id}`,
        ),
      ]),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToMenu),
          'broadcast:menu:panel',
        ),
      ],
    ]);
  }

  public getBroadcastCampaignDetails(
    ctx: IContext,
    params: { campaignId: number; active: boolean; paused: boolean },
  ) {
    return Markup.inlineKeyboard([
      ...(params.active
        ? [
            [
              params.paused
                ? Markup.button.callback(
                    ctx.i18n.t(LocalePhrase.Button_Broadcast_Resume),
                    'broadcast:queue:resume',
                  )
                : Markup.button.callback(
                    ctx.i18n.t(LocalePhrase.Button_Broadcast_Pause),
                    'broadcast:queue:pause',
                  ),
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_Terminate),
                'broadcast:queue:terminate',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Delete),
          `broadcast:campaign:delete:${params.campaignId}`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToList),
          'broadcast:menu:list',
        ),
      ],
    ]);
  }

  public getBroadcastCampaignDeleteConfirmation(
    ctx: IContext,
    campaignId: number,
  ) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_DeleteAll),
          `broadcast:campaign:delete:all:${campaignId}`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_DeleteSelect),
          `broadcast:campaign:delete:select:${campaignId}:1`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          `broadcast:campaign:detail:${campaignId}`,
        ),
      ],
    ]);
  }

  public getBroadcastFeedbackButton(
    text: string,
    deliveryId: number,
    action: 'initial' | 'repeat' = 'initial',
  ) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          text,
          `broadcast:feedback:${deliveryId}:${action}`,
        ),
      ],
    ]);
  }

  public getBroadcastCampaignDeleteSelector(params: {
    ctx: IContext;
    campaignId: number;
    items: { id: number; title: string; selected: boolean }[];
    currentPage: number;
    totalPages: number;
    selectedCount: number;
  }) {
    return this.getPagination({
      name: `broadcast-delete:${params.campaignId}`,
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: `${item.selected ? '✅' : '⬜'} ${item.title}`,
        payload: String(item.id),
      })),
      actionPrefix: `broadcast:campaign:delete:toggle:${params.campaignId}:${params.currentPage}:`,
      additionalButtons: [
        Markup.button.callback(
          params.ctx.i18n.t(LocalePhrase.Button_Broadcast_DeleteSelected, {
            selectedCount: params.selectedCount,
          }),
          `broadcast:campaign:delete:selected:${params.campaignId}:${params.currentPage}`,
        ),
        Markup.button.callback(
          params.ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          `broadcast:campaign:detail:${params.campaignId}`,
        ),
      ],
      columnizer: false,
      sortByLength: false,
    });
  }

  public getBroadcastConfirm(ctx: IContext, mode: 'copy' | 'forward') {
    const nextMode = mode === 'copy' ? 'forward' : 'copy';

    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_CreateQueue),
          'broadcast:wizard:send',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ModeToggle, {
            mode,
            nextMode,
          }),
          `broadcast:wizard:mode:${nextMode}`,
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          'broadcast:wizard:back',
        ),
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
    } = {},
  ) {
    const {
      manualMode = false,
      onlyAuthorized = false,
      groupName = null,
      feedbackButton = null,
    } = options;

    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          manualMode
            ? ctx.i18n.t(LocalePhrase.Button_Broadcast_AudienceAll)
            : ctx.i18n.t(LocalePhrase.Button_Broadcast_AudienceManual),
          manualMode
            ? 'broadcast:wizard:audience:all'
            : 'broadcast:wizard:audience:manual',
        ),
      ],
      ...(manualMode
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_SelectRecipients),
                'broadcast:wizard:recipients:1',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_EditFilters, {
            onlyAuthorized,
            groupName: groupName || '-',
          }),
          'broadcast:wizard:filters',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackToggle, {
            feedbackButton,
          }),
          'broadcast:wizard:feedback:settings',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Continue),
          'broadcast:wizard:continue',
        ),
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
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackToggle, {
            feedbackButton,
          }),
          'broadcast:wizard:feedback:toggle',
        ),
      ],
      ...(feedbackButton
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackText),
                'broadcast:wizard:feedback:text',
              ),
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackResponse),
                'broadcast:wizard:feedback:response',
              ),
            ],
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackAfterToggle, {
                  feedbackAfterClickText: feedbackButton.afterClickText,
                }),
                'broadcast:wizard:feedback:after-toggle',
              ),
            ],
            ...(feedbackButton.afterClickText
              ? [
                  [
                    Markup.button.callback(
                      ctx.i18n.t(
                        LocalePhrase.Button_Broadcast_FeedbackAfterText,
                      ),
                      'broadcast:wizard:feedback:after-text',
                    ),
                  ],
                ]
              : []),
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          'broadcast:wizard:feedback:back',
        ),
      ],
    ]);
  }

  public getBroadcastExcludeCampaignsSelector(params: {
    ctx: IContext;
    items: { id: number; title: string; selected: boolean }[];
    currentPage: number;
    totalPages: number;
    selectedCount: number;
  }) {
    return this.getPagination({
      name: 'broadcast-filter-exclude-campaigns',
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: `${item.selected ? '✅' : '⬜'} ${item.title}`,
        payload: String(item.id),
      })),
      actionPrefix: `broadcast:wizard:filter:exclude-campaigns:toggle:${params.currentPage}:`,
      additionalButtons: [
        Markup.button.callback(
          params.ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterExcludeCampaignsDone,
            { selectedCount: params.selectedCount },
          ),
          'broadcast:wizard:filter:exclude-campaigns:done',
        ),
      ],
      columnizer: false,
      sortByLength: false,
    });
  }

  public getBroadcastFilters(
    ctx: IContext,
    params: {
      hasGroups: boolean;
      onlyAuthorized: boolean;
      hasActivityFilter: boolean;
      hasExcludedCampaigns: boolean;
    },
  ) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterAuthorized, params),
          'broadcast:wizard:filter:authorized',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroups, params),
          'broadcast:wizard:filter:groups',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterActivity, params),
          'broadcast:wizard:filter:activity',
        ),
        Markup.button.callback(
          ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterExcludeCampaigns,
            params,
          ),
          'broadcast:wizard:filter:exclude-campaigns',
        ),
      ],
      ...(params.hasGroups
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsShow),
                'broadcast:wizard:filter:groups:show',
              ),
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsClear),
                'broadcast:wizard:filter:groups:clear',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          'broadcast:wizard:settings',
        ),
      ],
    ]);
  }

  public getBroadcastGroupFilterMenu(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsInstitutes),
          'broadcast:wizard:filter:institutes:1',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsText),
          'broadcast:wizard:filter:groups:text',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          'broadcast:wizard:filters',
        ),
      ],
    ]);
  }

  /** Клавиатура остаётся рядом с подсказкой, пока администратор вводит список групп. */
  public getBroadcastGroupFilterTextPrompt(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsShow),
          'broadcast:wizard:filter:groups:text:show',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsTextCancel),
          'broadcast:wizard:filter:groups:text:cancel',
        ),
      ],
    ]);
  }

  public getBroadcastFilterTextPrompt(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterTextCancel),
          'broadcast:wizard:filter:text:cancel',
        ),
      ],
    ]);
  }

  public getBroadcastFeedbackTextPrompt(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          'broadcast:wizard:feedback:settings',
        ),
      ],
    ]);
  }

  public getAuth(
    ctx: IContext,
    inline?: true,
    social?: boolean,
    addSelectGroup?: boolean,
    addCancel?: boolean,
    authLink?: string,
  ): Markup.Markup<InlineKeyboardMarkup>;
  public getAuth(
    ctx: IContext,
    inline: false,
    social?: boolean,
    addSelectGroup?: boolean,
    addCancel?: boolean,
    authLink?: string,
  ): Markup.Markup<ReplyKeyboardMarkup>;
  public getAuth(
    ctx: IContext,
    social = false,
    inline = true,
    addSelectGroup = false,
    addCancel = true,
    authLink?: string,
  ) {
    const phrase = social
      ? LocalePhrase.Button_AuthLink_SocialConnect
      : LocalePhrase.Button_AuthLink;
    return {
      ...(inline
        ? Markup.inlineKeyboard([
            [
              authLink
                ? Markup.button.url(ctx.i18n.t(phrase), authLink)
                : Markup.button.callback(ctx.i18n.t(phrase), phrase),
            ],
            ...(addSelectGroup
              ? [
                  [
                    Markup.button.callback(
                      ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                      LocalePhrase.Button_SelectGroup,
                    ),
                    Markup.button.callback(
                      ctx.i18n.t(LocalePhrase.Button_Schedule_Teacher),
                      LocalePhrase.Button_Schedule_Teacher,
                    ),
                  ],
                ]
              : []),
            ...(addCancel
              ? [
                  [
                    Markup.button.callback(
                      ctx.i18n.t(LocalePhrase.Button_Cancel),
                      LocalePhrase.Button_Cancel,
                    ),
                  ],
                ]
              : []),
          ])
        : Markup.keyboard([
            [ctx.i18n.t(phrase)],
            ...(addSelectGroup
              ? [
                  [
                    ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                    ctx.i18n.t(LocalePhrase.Button_Schedule_Teacher),
                  ],
                ]
              : []),
            ...(addCancel ? [[ctx.i18n.t(LocalePhrase.Button_Cancel)]] : []),
          ]).resize()),
    };
  }

  public getSelectGroupInline(ctx: IContext, groupName?: string) {
    return Markup.inlineKeyboard([
      [
        groupName
          ? Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_SelectGroup_X, { groupName }),
              `selectGroup:${groupName}`,
            )
          : Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_SelectGroup),
              LocalePhrase.Button_SelectGroup,
            ),
      ],
    ]);
  }

  public getScheduleInline(
    ctx: IContext,
    target: { type: 'group'; id: string } | { type: 'teacher'; id: number },
  ) {
    const makeButton = (phrase: LocalePhrase) =>
      Markup.button.callback(
        ctx.i18n.t(phrase),
        target.type === 'teacher'
          ? `${phrase}:teacher:${target.id}`
          : `${phrase}:${target.id}`,
      );

    return Markup.inlineKeyboard([
      [
        makeButton(LocalePhrase.Button_Schedule_ForToday),
        makeButton(LocalePhrase.Button_Schedule_ForTomorrow),
      ],
      [
        makeButton(LocalePhrase.Button_Schedule_ForWeek),
        makeButton(LocalePhrase.Button_Schedule_ForNextWeek),
      ],
    ]);
  }

  /** Собирает keyboard пагинации из item-рядов, pager и дополнительных кнопок. */
  public getPagination<T extends PaginationItemType>(
    options: TelegramPaginationOptions<T>,
  ) {
    const {
      name,
      currentPage,
      totalPages,
      items,
      actionPrefix = '',
      additionalButtons = [],
      columnizer = false,
      sortByLength = true,
      pagerMode = 'edges',
      hidePager = false,
    } = options;

    const itemRows = this.getPaginationBuild({
      items,
      actionPrefix,
      columnizer,
      sortByLength,
    });
    const pagerRow = hidePager
      ? []
      : this.getPaginationPager({
          name,
          currentPage,
          totalPages,
          mode: pagerMode,
        });

    return Markup.inlineKeyboard([
      ...itemRows,
      ...[pagerRow],
      ...this.getPaginationAdditionalRows(additionalButtons),
    ]);
  }

  /** Строит ряды кнопок элементов с необязательным автоматическим разбиением по ширине. */
  public getPaginationBuild<T extends PaginationItemType>(params: {
    items?: (T | T[])[];
    actionPrefix?: string;
    columnizer?: boolean | number;
    sortByLength?: boolean;
  }) {
    let { items } = params;
    const actionPrefix = params.actionPrefix || '';
    const sortByLength = params.sortByLength !== false;
    const buttonsItems: Hideable<InlineKeyboardButton>[][] = [];
    let columns = 1;

    const maxLength = params.columnizer === true ? 10 : params.columnizer || 10;
    const columnizerBtns = params.columnizer !== false;

    if (items && items.length > 0) {
      if (columnizerBtns) {
        if (sortByLength) {
          items = items
            .flat(2)
            .sort(
              (a, b) =>
                (typeof a === 'string' ? a : a.title)?.length -
                (typeof b === 'string' ? b : b.title)?.length,
            ) as T[];
        }

        let longCnt = 0;
        const maxLengths = items.flat(2).reduce((acc, e) => {
          const len = (typeof e === 'string' ? e : e.title + (e.suffix || ''))
            ?.length;
          if (len >= maxLength) ++longCnt;
          return Math.max(acc, len);
        }, 0);
        columns =
          maxLengths < maxLength || longCnt / items.length < 0.5
            ? 4
            : longCnt / items.length < 0.7
              ? 2
              : 1;
      }

      let longBtnCounter = -1;
      let rowBtns: Hideable<InlineKeyboardButton>[] = [];
      for (let subitems of items) {
        if (!Array.isArray(subitems)) {
          subitems = [subitems];
        }
        for (const item of subitems) {
          const title =
            typeof item === 'string' ? item : item.title + (item.suffix || '');
          const payload = typeof item === 'string' ? item : item.payload;
          if (columnizerBtns) {
            if (
              title.length >= 16 ||
              (title.length >= 9 &&
                (longBtnCounter == -1 || ++longBtnCounter > 2))
            ) {
              buttonsItems.push(rowBtns);
              rowBtns = [];
              longBtnCounter = 0;
            }
          }
          rowBtns.push(
            Markup.button.callback(title, `${actionPrefix}${payload}`),
          );
          if (columnizerBtns) {
            if (rowBtns.length >= columns) {
              buttonsItems.push(rowBtns);
              rowBtns = [];
            }
          }
        }
        if (!columnizerBtns) {
          buttonsItems.push(rowBtns);
          rowBtns = [];
        }
      }

      if (rowBtns.length > 0) {
        buttonsItems.push(rowBtns);
      }
    }

    return buttonsItems;
  }

  /** Строит ряд навигации pagination, включая переходы к краям списка. */
  public getPaginationPager(params: {
    name: string;
    currentPage: number;
    totalPages: number;
    mode?: PaginationPagerMode;
  }) {
    const toBtn = (page: number, label: string) =>
      Markup.button.callback(label, `pager:${params.name}:${page}`);
    const noop = () => Markup.button.callback('-', 'nope');
    const { currentPage: curPage, totalPages } = params;
    const mode = params.mode || 'edges';

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

  /** Нормализует одиночный ряд или набор рядов дополнительных inline-кнопок. */
  private getPaginationAdditionalRows(
    buttons:
      | Hideable<InlineKeyboardButton>[]
      | Hideable<InlineKeyboardButton>[][],
  ) {
    return (
      (<E>(arr: E[] | E[][]): arr is E[][] => Array.isArray(arr[0]))(buttons)
        ? buttons
        : [buttons]
    ) as Hideable<InlineKeyboardButton>[][];
  }

  /**
   * Строит pagination конкретного списка преподавателей.
   * listId связывает callbacks с query и page size исходного сообщения.
   */
  public getTeachersListPagination(
    ctx: IContext,
    params: {
      listId: string;
      items: { id: number; name: string }[];
      currentPage: number;
      totalPages: number;
    },
  ) {
    return this.getPagination({
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

  public getActioner<T extends PaginationItemType>(
    ctx: IContext,
    items?: (T | T[])[],
    actionPrefix = 'action:',
  ) {
    const buttonsItems: Hideable<InlineKeyboardButton>[][] = [];
    if (items && items.length > 0) {
      for (let subitems of items) {
        if (!Array.isArray(subitems)) {
          subitems = [subitems];
        }
        const rowBtns: Hideable<InlineKeyboardButton>[] = [];
        for (const item of subitems) {
          const title = typeof item === 'string' ? item : item.title;
          const payload = typeof item === 'string' ? item : item.payload;
          rowBtns.push(
            Markup.button.callback(title, `${actionPrefix || ''}${payload}`),
          );
        }
        buttonsItems.push(rowBtns);
      }
    }
    return Markup.inlineKeyboard(buttonsItems);
  }

  public getClear(inline?: true): Markup.Markup<InlineKeyboardMarkup>;
  public getClear(inline: false): Markup.Markup<ReplyKeyboardRemove>;
  public getClear(inline = true) {
    return {
      ...(inline ? Markup.inlineKeyboard([]) : Markup.removeKeyboard()),
    };
  }

  public getCancel(ctx: IContext) {
    return {
      ...Markup.keyboard([[ctx.i18n.t(LocalePhrase.Button_Cancel)]]).resize(),
    };
  }

  public getCancelInline(ctx: IContext) {
    return {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            ctx.i18n.t(LocalePhrase.Button_Cancel),
            LocalePhrase.Button_Cancel,
          ),
        ],
      ]),
    };
  }

  public getICalendarInline(ctx: IContext, link: string, title: string) {
    return {
      ...Markup.inlineKeyboard([[Markup.button.url(title, link)]]),
    };
  }
}
