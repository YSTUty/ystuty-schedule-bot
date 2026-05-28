import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';
import type { IKeyboardProxyButton } from 'vk-io/lib/structures/keyboard/types';

import * as xEnv from '@my-environment';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

type VKPaginationItem =
  | string
  | { title: string; payload: Record<string, unknown>; selected?: boolean };

@Injectable()
export class VKKeyboardFactory {
  public needInline(ctx: IContext) {
    return ctx.isChat && ctx.sessionConversation.hideStaticKeyboard !== false;
  }

  public getStart(ctx: IContext) {
    const isAdmin =
      xEnv.SOCIAL_VK_ADMIN_IDS.includes(ctx.senderId || ctx.peerId) ||
      ctx.state.user?.role === 'admin';

    return Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule),
          payload: { phrase: LocalePhrase.Button_Schedule_Schedule },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        ...(ctx.isDM && ctx.state.user
          ? [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_Profile),
                payload: { phrase: LocalePhrase.Button_Profile },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ]
          : []),
      ],
      [
        ...(isAdmin
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

  public getPagination(params: {
    currentPage: number;
    totalPages: number;
    items?: (VKPaginationItem | VKPaginationItem[])[];
    getPagePayload: (page: number) => Record<string, unknown>;
    additionalButtons?: IKeyboardProxyButton[][];
  }) {
    const rows: IKeyboardProxyButton[][] = [];

    for (const itemOrRow of params.items || []) {
      const row = Array.isArray(itemOrRow) ? itemOrRow : [itemOrRow];
      rows.push(
        row.map((item) => {
          const title = typeof item === 'string' ? item : item.title;
          const payload = typeof item === 'string' ? {} : item.payload;
          const selected = typeof item === 'string' ? false : item.selected;

          return Keyboard.callbackButton({
            label: title,
            payload,
            color: selected
              ? Keyboard.POSITIVE_COLOR
              : Keyboard.SECONDARY_COLOR,
          });
        }),
      );
    }

    rows.push([
      ...(params.currentPage > 1
        ? [
            Keyboard.callbackButton({
              label: '‹',
              payload: params.getPagePayload(params.currentPage - 1),
              color: Keyboard.SECONDARY_COLOR,
            }),
          ]
        : []),
      Keyboard.callbackButton({
        label: `${params.currentPage}/${params.totalPages}`,
        payload: params.getPagePayload(params.currentPage),
        color: Keyboard.SECONDARY_COLOR,
      }),
      ...(params.currentPage < params.totalPages
        ? [
            Keyboard.callbackButton({
              label: '›',
              payload: params.getPagePayload(params.currentPage + 1),
              color: Keyboard.SECONDARY_COLOR,
            }),
          ]
        : []),
    ]);

    return Keyboard.keyboard([...rows, ...(params.additionalButtons || [])]);
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

  public getSchedule(ctx: IContext, groupName?: string) {
    return Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForToday),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForToday,
            groupName,
          },
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForTomorrow),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForTomorrow,
            groupName,
          },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForWeek),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForWeek,
            groupName,
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForNextWeek),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForNextWeek,
            groupName,
          },
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
