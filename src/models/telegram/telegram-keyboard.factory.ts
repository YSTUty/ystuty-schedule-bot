import { Injectable } from '@nestjs/common';

import type { Markup as TelegrafMarkup } from 'telegraf-hardened';
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from 'telegraf-hardened/types';

import * as xEnv from '@my-environment';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import type { ScheduleWeekView } from '../schedule/schedule.service';

import {
  TelegramMarkup as Markup,
  TelegramButtonOptions,
  TelegramButtons,
} from './telegram-buttons.util';

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
        ? [
            [
              TelegramButtons.text(
                ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule),
                { style: 'primary' },
              ),
            ],
          ]
        : isPrivate
          ? [
              [
                TelegramButtons.text(
                  ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                  { style: 'primary' },
                ),
              ],
            ]
          : [
              [
                TelegramButtons.text(
                  ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule),
                  { style: 'primary' },
                ),
              ],
            ]),
      ...(isPrivate && !hasTeacher
        ? [[ctx.i18n.t(LocalePhrase.Button_Schedule_Teacher)]]
        : isPrivate && hasTeacher
          ? [[ctx.i18n.t(LocalePhrase.Button_Schedule_MyTeacher)]]
          : []),
      ...(isPrivate
        ? [
            ...(ctx.user ? [[ctx.i18n.t(LocalePhrase.Button_Profile)]] : []),
            [ctx.i18n.t(LocalePhrase.Button_ScheduleNotif)],
            [ctx.i18n.t(LocalePhrase.Button_Calendar)],
          ]
        : []),
      ...(isPrivate ? [[ctx.i18n.t(LocalePhrase.Button_Feedback)]] : []),
      ...(!isPrivate ? [[ctx.i18n.t(LocalePhrase.Button_ScheduleNotif)]] : []),
      ...(isPrivate && isAdmin
        ? [[ctx.i18n.t(LocalePhrase.Button_Broadcast)]]
        : []),
      ...(isPrivate ? this.getWebAppRows() : []),
    ]).resize();
  }

  public getInviteToChat(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        TelegramButtons.url(
          ctx.i18n.t(LocalePhrase.Button_InviteToChat),
          `https://t.me/${xEnv.SOCIAL_TELEGRAM_BOT_NAME}?startgroup=invite`,
          { style: 'primary' },
        ),
      ],
    ]);
  }

  /** Inline-кнопка справки для ответа на нераспознанное сообщение. */
  public getUnknownMessageHelp(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Help),
          'help:open',
          { style: 'primary' },
        ),
      ],
    ]);
  }

  /** Быстрые действия из приветственной карточки личного чата. */
  public getWelcomeFeatures(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Welcome_SelectGroup),
          LocalePhrase.Button_SelectGroup,
          { style: 'primary' },
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Welcome_ScheduleNotif),
          LocalePhrase.Button_ScheduleNotif,
        ),
      ],
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Welcome_Guide),
          'help:open',
          { style: 'primary' },
        ),
      ],
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Calendar),
          'calendar:open',
          { style: 'primary' },
        ),
      ],
      [
        Markup.button.url(
          ctx.i18n.t(LocalePhrase.Button_Welcome_InviteToChat),
          `https://t.me/${xEnv.SOCIAL_TELEGRAM_BOT_NAME}?startgroup=invite`,
        ),
      ],
      ...this.getWebAppRows(),
    ]);
  }

  /** Собирает до двух опциональных кнопок Mini App из конфигурации окружения. */
  private getWebAppRows() {
    const options: {
      name: string;
      url: string;
      style: TelegramButtonOptions['style'];
    }[] = [
      {
        name: xEnv.SOCIAL_TELEGRAM_BOT_WEBAPP_NAME,
        url: xEnv.SOCIAL_TELEGRAM_WEBAPP_URL,
        style: 'primary',
      },
      {
        name: xEnv.SOCIAL_TELEGRAM_BOT_WEBAPP_NAME_2,
        url: xEnv.SOCIAL_TELEGRAM_WEBAPP_URL_2,
        style: 'success',
      },
    ];
    const buttons = options.flatMap(({ name, url, style }) => {
      const text = name.trim();
      const webAppUrl = url.trim();
      return text && webAppUrl
        ? [TelegramButtons.webApp(text, webAppUrl, { style })]
        : [];
    });

    return buttons.length ? [buttons] : [];
  }

  public getAuth(
    ctx: IContext,
    inline?: true,
    social?: boolean,
    addSelectGroup?: boolean,
    addCancel?: boolean,
    authLink?: string,
  ): TelegrafMarkup.Markup<InlineKeyboardMarkup>;
  public getAuth(
    ctx: IContext,
    inline: false,
    social?: boolean,
    addSelectGroup?: boolean,
    addCancel?: boolean,
    authLink?: string,
  ): TelegrafMarkup.Markup<ReplyKeyboardMarkup>;
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
                ? TelegramButtons.url(ctx.i18n.t(phrase), authLink, {
                    style: 'primary',
                  })
                : TelegramButtons.callback(ctx.i18n.t(phrase), phrase, {
                    style: 'primary',
                  }),
            ],
            ...(addSelectGroup
              ? [
                  [
                    TelegramButtons.callback(
                      ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                      LocalePhrase.Button_SelectGroup,
                      { style: 'primary' },
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
                    TelegramButtons.callback(
                      ctx.i18n.t(LocalePhrase.Button_Cancel),
                      LocalePhrase.Button_Cancel,
                      { style: 'danger' },
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
          ? TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_SelectGroup_X, { groupName }),
              `selectGroup:${md5(groupName).slice(0, 12)}`,
              { style: 'primary' },
            )
          : TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_SelectGroup),
              LocalePhrase.Button_SelectGroup,
              { style: 'primary' },
            ),
      ],
    ]);
  }

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

  public getClear(inline?: true): TelegrafMarkup.Markup<InlineKeyboardMarkup>;
  public getClear(inline: false): TelegrafMarkup.Markup<ReplyKeyboardRemove>;
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
          TelegramButtons.callback(
            ctx.i18n.t(LocalePhrase.Button_Cancel),
            LocalePhrase.Button_Cancel,
            { style: 'danger' },
          ),
        ],
      ]),
    };
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
