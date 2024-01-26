import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { Markup as MarkupType } from 'telegraf/typings/markup';
import {
  InlineKeyboardMarkup,
  InlineKeyboardButton,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from 'telegraf/typings/core/types/typegram';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

type Hideable<B> = B & { hide?: boolean };
export type PaginationItemType =
  | string
  | { title: string; suffix?: string; payload: string };

@Injectable()
export class TelegramKeyboardFactory {
  public getStart(ctx: IContext) {
    return Markup.keyboard([
      [ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule)],
      [
        ...(ctx.chat.type === 'private' && ctx.user
          ? [ctx.i18n.t(LocalePhrase.Button_Profile)]
          : []),
      ],
    ]).resize();
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

  public getScheduleInline(ctx: IContext, groupName: string = '') {
    const makeButton = (phrase: LocalePhrase) =>
      Markup.button.callback(
        ctx.i18n.t(phrase),
        groupName ? `${phrase}:${groupName}` : phrase,
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

  public getPagination<T extends PaginationItemType>(
    name: string,
    current: number,
    maxpage: number,
    items?: (T | T[])[],
    actionPrefix: string = '',
    additionalButtons:
      | Hideable<InlineKeyboardButton>[]
      | Hideable<InlineKeyboardButton>[][] = [],
    columnizerBtns: boolean | number = false,
    sortByLength: boolean = true,
  ) {
    const buttonsItems: Hideable<InlineKeyboardButton>[][] = [];
    let columns = 1;

    const maxLength = columnizerBtns === true ? 10 : columnizerBtns || 10;
    columnizerBtns = columnizerBtns !== false;

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
        let maxLengths = items.flat(2).reduce((acc, e) => {
          let len = (typeof e === 'string' ? e : e.title + (e.suffix || ''))
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
        for (let item of subitems) {
          let title =
            typeof item === 'string' ? item : item.title + (item.suffix || '');
          let payload = typeof item === 'string' ? item : item.payload;
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
            Markup.button.callback(title, `${actionPrefix || ''}${payload}`),
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

    const buttonsPager: Hideable<InlineKeyboardButton>[] = [];
    buttonsPager.push(
      current > 1
        ? Markup.button.callback(`«1`, `pager:${name}:1`)
        : Markup.button.callback(`☺`, 'nope'),
      current > 2
        ? Markup.button.callback(
            `‹${current - 1}`,
            `pager:${name}:${current - 1}`,
          )
        : Markup.button.callback(`☺`, 'nope'),
      Markup.button.callback(`-${current}-`, `pager:${name}:${current}`),
      current < maxpage - 1
        ? Markup.button.callback(
            `${current + 1}›`,
            `pager:${name}:${current + 1}`,
          )
        : Markup.button.callback(`☺`, 'nope'),
      current < maxpage
        ? Markup.button.callback(`${maxpage}»`, `pager:${name}:${maxpage}`)
        : Markup.button.callback(`☺`, 'nope:The end'),
    );

    return Markup.inlineKeyboard([
      ...buttonsItems,
      buttonsPager,
      ...((<E>(arr: E[] | E[][]): arr is E[][] => Array.isArray(arr[0]))(
        additionalButtons,
      )
        ? additionalButtons
        : [additionalButtons]),
    ]);
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
