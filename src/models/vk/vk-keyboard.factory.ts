import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';
import type { IKeyboardProxyButton } from 'vk-io/lib/structures/keyboard/types';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

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
  /** Для двух страниц освобождает кнопку текущей страницы под элемент списка. */
  adaptiveTwoPagesWithoutCurrent?: boolean;
  /** До какого числа страниц adaptive pager остаётся компактным. @default 4 */
  adaptiveCompactMaxPages?: number;
  /** Центральный индикатор возвращает к середине списка вместо текущей страницы. */
  centerButtonToMiddle?: boolean;
};

export type PaginationPagerMode =
  | 'compact'
  | 'compact-pages'
  | 'adaptive'
  | 'edges'
  | 'nearby';

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

  /** Собирает VK pagination из item-рядов, pager и дополнительных кнопок. */
  public getPagination(params: VKPaginationOptions) {
    const itemRows = this.getPaginationBuild(params);
    const pagerRow = this.getPaginationPager(params);
    const rows = [
      ...itemRows,
      ...(pagerRow.length ? [pagerRow] : []),
      ...(params.additionalButtons || []),
    ];
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
    // Одностраничному списку pager не нужен: освободившийся ряд можно отдать элементам.
    const maxItemsRows = Math.max(
      0,
      VK_INLINE_KEYBOARD_MAX_ROWS -
        (this.shouldShowPaginationPager(params) ? 1 : 0) -
        additionalButtons.length,
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
    // Для длинного выбора групп центральная кнопка служит быстрым возвратом
    // к середине; остальные pagination по умолчанию сохраняют прежний callback.
    const middlePage = Math.ceil(totalPages / 2);
    const currentPageButton = (label: string) =>
      toBtn(params.centerButtonToMiddle ? middlePage : curPage, label);

    if (!this.shouldShowPaginationPager(params)) {
      return [];
    }

    if (mode === 'adaptive') {
      // Заголовок списка уже содержит N/M. Для короткого списка оставляем
      // читаемые переходы со стрелками и номерами целевых страниц.
      const adaptiveCompactMaxPages = params.adaptiveCompactMaxPages ?? 4;
      if (totalPages <= adaptiveCompactMaxPages) {
        return this.getAdaptivePaginationPager(
          params,
          toBtn,
          noop,
          params.centerButtonToMiddle ? middlePage : curPage,
          adaptiveCompactMaxPages,
        );
      }
    }

    if (mode === 'compact' || mode === 'compact-pages') {
      return [
        curPage > 1 ? toBtn(curPage - 1, '‹') : noop(),
        currentPageButton(
          mode === 'compact-pages'
            ? `-${curPage}/${totalPages}-`
            : `-${curPage}-`,
        ),
        curPage < totalPages ? toBtn(curPage + 1, '›') : noop(),
      ];
    }

    if (mode === 'edges' || mode === 'adaptive') {
      return [
        curPage > 1 ? toBtn(1, '«1') : noop(),
        curPage > 1 ? toBtn(curPage - 1, `‹${curPage - 1}`) : noop(),
        currentPageButton(`-${curPage}-`),
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
      currentPageButton(`-${curPage}-`),
      nextMiddle > curPage && nextMiddle < totalPages
        ? toBtn(nextMiddle, `${nextMiddle}»`)
        : noop(),
      curPage < totalPages ? toBtn(curPage + 1, `${curPage + 1}›`) : noop(),
    ];
  }

  private shouldShowPaginationPager(params: VKPaginationOptions) {
    return params.totalPages > 1;
  }

  /**
   * До четырёх страниц достаточно переходов к соседней. Edge-переходы нужны
   * только с пяти страниц; на границах сохраняем ширину ряда через noop.
   */
  private getAdaptivePaginationPager(
    params: VKPaginationOptions,
    toBtn: (page: number, label: string) => IKeyboardProxyButton,
    noop: () => IKeyboardProxyButton,
    middlePage: number,
    compactMaxPages: number,
  ) {
    const { currentPage: curPage, totalPages } = params;
    const currentPageButton = () =>
      toBtn(middlePage, `-${curPage}/${totalPages}-`);

    if (totalPages === 2) {
      if (params.adaptiveTwoPagesWithoutCurrent) {
        return curPage === 1
          ? [noop(), toBtn(2, '2›')]
          : [toBtn(1, '‹1'), noop()];
      }
      if (curPage === 1) {
        return [noop(), currentPageButton(), toBtn(2, '2›')];
      }
      return [toBtn(1, '‹1'), currentPageButton(), noop()];
    }

    if (totalPages <= compactMaxPages) {
      return [
        curPage > 1 ? toBtn(curPage - 1, `‹${curPage - 1}`) : noop(),
        currentPageButton(),
        curPage < totalPages ? toBtn(curPage + 1, `${curPage + 1}›`) : noop(),
      ];
    }

    if (curPage === 1) {
      return [
        noop(),
        noop(),
        currentPageButton(),
        toBtn(2, '2›'),
        toBtn(totalPages, `${totalPages}»`),
      ];
    }

    if (curPage === totalPages) {
      return [
        toBtn(1, '«1'),
        toBtn(totalPages - 1, `‹${totalPages - 1}`),
        currentPageButton(),
        noop(),
        noop(),
      ];
    }

    return [
      toBtn(1, '«1'),
      toBtn(curPage - 1, `‹${curPage - 1}`),
      currentPageButton(),
      toBtn(curPage + 1, `${curPage + 1}›`),
      toBtn(totalPages, `${totalPages}»`),
    ];
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
