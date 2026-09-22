import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';
import type { IKeyboardProxyButton } from 'vk-io/lib/structures/keyboard/types';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import {
  BroadcastActionKeyboard,
  BroadcastFeedbackButton,
  BroadcastRecipientAction,
  getBroadcastFeedbackAfterClickMode,
} from '../../../broadcast/broadcast.types';
import { getVKButtonLabel, VKKeyboardFactory } from '../../vk-keyboard.factory';

@Injectable()
export class VkBroadcastKeyboardFactory {
  constructor(private readonly baseKeyboardFactory: VKKeyboardFactory) {}

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
    params: {
      items: { id: number; status: string }[];
      currentPage: number;
      totalPages: number;
    },
  ) {
    return this.baseKeyboardFactory.getPagination({
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: `№${item.id} • ${item.status}`,
        payload: {
          broadcastAction: 'detail',
          campaignId: item.id,
          page: params.currentPage,
        },
      })),
      getPagePayload: (page) => ({ broadcastAction: 'menuList', page }),
      additionalButtons: [
        [
          Keyboard.callbackButton({
            label: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToMenu),
            payload: { broadcastAction: 'menuPanel' },
            color: Keyboard.SECONDARY_COLOR,
          }),
        ],
      ],
      pagerMode: 'compact-pages',
    });
  }

  public getBroadcastCampaignDetails(
    ctx: IContext,
    params: {
      campaignId: number;
      page: number;
      active: boolean;
      paused: boolean;
    },
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
          payload: { broadcastAction: 'menuList', page: params.page },
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
      if (actionButton.type === 'link') {
        rows.push([
          Keyboard.urlButton({
            label: getVKButtonLabel(actionButton.text),
            url: actionButton.url,
          }),
        ]);
        continue;
      }
      rows.push([
        Keyboard.callbackButton({
          label: getVKButtonLabel(
            actionButton.text ||
              (actionButton.type === 'auth'
                ? 'Подключить или обновить ЯГТУ.ID'
                : actionButton.type === 'start'
                  ? 'Начать'
                  : actionButton.type === 'unsubscribe'
                    ? '🔕 Отключить уведомления'
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
    return this.baseKeyboardFactory.getPagination({
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
      afterClickMode?: 'delete' | 'keep' | 'replace' | null;
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
                  LocalePhrase.Button_Broadcast_FeedbackAfterDelete,
                  {
                    selected:
                      getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                      'delete',
                  },
                ),
                payload: { broadcastAction: 'feedbackAfterDelete' },
                color:
                  getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                  'delete'
                    ? Keyboard.POSITIVE_COLOR
                    : Keyboard.SECONDARY_COLOR,
              }),
              Keyboard.callbackButton({
                label: ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_FeedbackAfterKeep,
                  {
                    selected:
                      getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                      'keep',
                  },
                ),
                payload: { broadcastAction: 'feedbackAfterKeep' },
                color:
                  getBroadcastFeedbackAfterClickMode(feedbackButton) === 'keep'
                    ? Keyboard.POSITIVE_COLOR
                    : Keyboard.SECONDARY_COLOR,
              }),
              Keyboard.callbackButton({
                label: ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_FeedbackAfterReplace,
                  {
                    selected:
                      getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                      'replace',
                  },
                ),
                payload: { broadcastAction: 'feedbackAfterReplace' },
                color:
                  getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                  'replace'
                    ? Keyboard.POSITIVE_COLOR
                    : Keyboard.SECONDARY_COLOR,
              }),
            ],
            ...(getBroadcastFeedbackAfterClickMode(feedbackButton) === 'replace'
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
    const start = getAction('start');
    const unsubscribe = getAction('unsubscribe');
    const link = getAction('link');

    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionSelectGroup, {
            actionButton: selectGroup,
          }),
          payload: { broadcastAction: 'actionSelectGroupToggle' },
          color: selectGroup
            ? Keyboard.POSITIVE_COLOR
            : Keyboard.NEGATIVE_COLOR,
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionAuth, {
            actionButton: auth,
          }),
          payload: { broadcastAction: 'actionAuthToggle' },
          color: auth ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionStart, {
            actionButton: start,
          }),
          payload: { broadcastAction: 'actionStartToggle' },
          color: start ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR,
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionUnsubscribe, {
            actionButton: unsubscribe,
          }),
          payload: { broadcastAction: 'actionUnsubscribeToggle' },
          color: unsubscribe
            ? Keyboard.POSITIVE_COLOR
            : Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionLink, {
            actionButton: link,
          }),
          payload: { broadcastAction: 'actionLinkToggle' },
          color: link ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR,
        }),
        ...(link
          ? [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionLinkUrl),
                payload: { broadcastAction: 'actionLinkUrl' },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ]
          : []),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionText),
          payload: { broadcastAction: 'actionTextSelector' },
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          payload: { broadcastAction: 'actionBack' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  /** Выбор включённой action-кнопки перед редактированием её подписи. */
  public getBroadcastActionTextSelector(
    ctx: IContext,
    actionKeyboard: BroadcastActionKeyboard = [],
  ) {
    const actionNames: Record<BroadcastRecipientAction | 'link', string> = {
      select_group: 'Группа',
      auth: 'ЯГТУ.ID',
      start: 'Начать',
      unsubscribe: 'Отключить уведомления',
      link: 'Ссылка',
    };
    const actionPayloads: Record<BroadcastRecipientAction | 'link', string> = {
      select_group: 'actionSelectGroupText',
      auth: 'actionAuthText',
      start: 'actionStartText',
      unsubscribe: 'actionUnsubscribeText',
      link: 'actionLinkText',
    };
    const rows: IKeyboardProxyButton[][] = [];
    for (let index = 0; index < actionKeyboard.length; index += 2) {
      rows.push(
        actionKeyboard.slice(index, index + 2).map((actionButton) =>
          Keyboard.callbackButton({
            label: getVKButtonLabel(
              `✏️ ${actionButton.text || actionNames[actionButton.type]}`,
            ),
            payload: { broadcastAction: actionPayloads[actionButton.type] },
            color: Keyboard.SECONDARY_COLOR,
          }),
        ),
      );
    }
    rows.push([
      Keyboard.callbackButton({
        label: ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
        payload: { broadcastAction: 'actionSettings' },
        color: Keyboard.PRIMARY_COLOR,
      }),
    ]);

    return Keyboard.keyboard(rows);
  }

  /** Подтверждение отключения персональных рассылок. */
  public getBroadcastUnsubscribeConfirmation(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Broadcast_UnsubscribeConfirm),
          payload: { broadcastUnsubscribe: 'confirm' },
          color: Keyboard.NEGATIVE_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { broadcastUnsubscribe: 'cancel' },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getBroadcastActivityFilterMenu(
    ctx: IContext,
    includeNoActivity: boolean,
  ) {
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
          label: 'Был активен с даты',
          payload: { broadcastAction: 'filterActivityAfter' },
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
          label: ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterActivityIncludeNoActivity,
            { includeNoActivity },
          ),
          payload: { broadcastAction: 'filterActivityIncludeNoActivity' },
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
    return this.baseKeyboardFactory.getPagination({
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
    return this.baseKeyboardFactory.getPagination({
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
}
