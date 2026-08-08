import { Injectable } from '@nestjs/common';

import { Markup } from 'telegraf';
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from 'telegraf/typings/core/types/typegram';
import { Markup as MarkupType } from 'telegraf/typings/markup';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

type Hideable<B> = B & { hide?: boolean };
export type PaginationItemType =
  | string
  | { title: string; suffix?: string; payload: string };

type TelegramPaginationOptions<T extends PaginationItemType> = {
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
      ...(isPrivate && ctx.user
        ? [[ctx.i18n.t(LocalePhrase.Button_Profile)]]
        : []),
      ...(isAdmin ? [[ctx.i18n.t(LocalePhrase.Button_Broadcast)]] : []),
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

  public getBroadcastSettings(ctx: IContext, manualMode = false) {
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
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_SelectRecipients),
          'broadcast:wizard:recipients:1',
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
    } = options;

    const itemRows = this.getPaginationBuild({
      items,
      actionPrefix,
      columnizer,
      sortByLength,
    });
    const pagerRow = this.getPaginationPager({
      name,
      currentPage,
      totalPages,
      mode: pagerMode,
    });

    return Markup.inlineKeyboard([
      ...itemRows,
      pagerRow,
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
    const toButton = (page: number, label: string) =>
      Markup.button.callback(label, `pager:${params.name}:${page}`);
    const noop = () => Markup.button.callback('-', 'nope');
    const { currentPage, totalPages } = params;
    const mode = params.mode || 'edges';

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
