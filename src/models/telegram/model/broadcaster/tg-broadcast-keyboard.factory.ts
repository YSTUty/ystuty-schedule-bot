import { Injectable } from '@nestjs/common';

import type { InlineKeyboardButton } from 'telegraf-hardened/types';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import {
  BroadcastActionKeyboard,
  BroadcastFeedbackButton,
  getBroadcastFeedbackAfterClickMode,
} from '../../../broadcast/broadcast.types';
import {
  TelegramMarkup as Markup,
  TelegramButtons,
} from '../../telegram-buttons.util';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

@Injectable()
export class TgBroadcastKeyboardFactory {
  constructor(private readonly baseKeyboardFactory: TelegramKeyboardFactory) {}

  public getBroadcastQueueControls(ctx: IContext, paused = true) {
    return Markup.inlineKeyboard([
      [
        paused
          ? TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_Broadcast_Resume),
              'broadcast:queue:resume',
              { style: 'success' },
            )
          : TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_Broadcast_Pause),
              'broadcast:queue:pause',
              { style: 'primary' },
            ),
      ],
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Terminate),
          'broadcast:queue:terminate',
          { style: 'danger' },
        ),
      ],
    ]);
  }
  public getBroadcastMenu(ctx: IContext, hasCurrent = false) {
    return this.baseKeyboardFactory.getActioner(
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
    params: {
      items: { id: number; status: string }[];
      currentPage: number;
      totalPages: number;
    },
  ) {
    return this.baseKeyboardFactory.getPagination({
      name: 'broadcast-campaigns',
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: `№${item.id} • ${item.status}`,
        payload: `${item.id}:${params.currentPage}`,
      })),
      actionPrefix: 'broadcast:campaign:detail:',
      additionalButtons: [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToMenu),
          'broadcast:menu:panel',
        ),
      ],
      columnizer: false,
      sortByLength: false,
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
    return Markup.inlineKeyboard([
      ...(params.active
        ? [
            [
              params.paused
                ? TelegramButtons.callback(
                    ctx.i18n.t(LocalePhrase.Button_Broadcast_Resume),
                    'broadcast:queue:resume',
                    { style: 'success' },
                  )
                : TelegramButtons.callback(
                    ctx.i18n.t(LocalePhrase.Button_Broadcast_Pause),
                    'broadcast:queue:pause',
                    { style: 'primary' },
                  ),
              TelegramButtons.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_Terminate),
                'broadcast:queue:terminate',
                { style: 'danger' },
              ),
            ],
          ]
        : []),
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ApplySettings),
          `broadcast:campaign:apply:${params.campaignId}`,
          { style: 'primary' },
        ),
      ],
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Delete),
          `broadcast:campaign:delete:${params.campaignId}`,
          { style: 'danger' },
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToList),
          `broadcast:campaign:list:${params.page}`,
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

  /** Собирает action- и feedback-ряды одной inline-клавиатуры рассылки. */
  public getBroadcastRecipientKeyboard(params: {
    actionKeyboard?: BroadcastActionKeyboard | null;
    feedbackButton?: BroadcastFeedbackButton | null;
    feedbackAction?: 'initial' | 'repeat';
    deliveryId: number;
  }) {
    const rows: InlineKeyboardButton[][] = [];
    for (const actionButton of params.actionKeyboard || []) {
      if (actionButton.type === 'link') {
        rows.push([Markup.button.url(actionButton.text, actionButton.url)]);
        continue;
      }
      const label =
        actionButton.text ||
        (actionButton.type === 'auth'
          ? 'Подключить или обновить ЯГТУ.ID'
          : actionButton.type === 'start'
            ? 'Начать'
            : actionButton.type === 'unsubscribe'
              ? '🔕 Отключить уведомления'
              : 'Выбрать актуальную группу');
      rows.push([
        Markup.button.callback(
          label,
          `broadcast:action:${params.deliveryId}:${actionButton.type}`,
        ),
      ]);
    }
    if (params.feedbackButton) {
      rows.push([
        Markup.button.callback(
          params.feedbackButton.text,
          `broadcast:feedback:${params.deliveryId}:${params.feedbackAction || 'initial'}`,
        ),
      ]);
    }
    return Markup.inlineKeyboard(rows);
  }

  /** Подтверждение отключения персональных рассылок. */
  public getBroadcastUnsubscribeConfirmation(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_UnsubscribeConfirm),
          'broadcast:unsubscribe:confirm',
          { style: 'danger' },
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Cancel),
          'broadcast:unsubscribe:cancel',
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
    return this.baseKeyboardFactory.getPagination({
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

  public getBroadcastConfirm(
    ctx: IContext,
    mode: 'copy' | 'forward',
    hasRecipientKeyboard = false,
  ) {
    const nextMode = mode === 'copy' ? 'forward' : 'copy';

    return Markup.inlineKeyboard([
      [
        TelegramButtons.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_CreateQueue),
          'broadcast:wizard:send',
          { style: 'success' },
        ),
      ],
      ...(mode === 'forward' && hasRecipientKeyboard
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(
                  LocalePhrase.Button_Broadcast_ForwardKeyboardMessageText,
                ),
                'broadcast:wizard:forward-keyboard:text',
              ),
            ],
          ]
        : []),
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
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionButtons, {
            actionButtonsCount: actionKeyboard?.length || 0,
          }),
          'broadcast:wizard:actions:settings',
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
      afterClickMode?: 'delete' | 'keep' | 'replace' | null;
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
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackAfterDelete, {
                  selected:
                    getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                    'delete',
                }),
                'broadcast:wizard:feedback:after:delete',
              ),
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackAfterKeep, {
                  selected:
                    getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                    'keep',
                }),
                'broadcast:wizard:feedback:after:keep',
              ),
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_FeedbackAfterReplace, {
                  selected:
                    getBroadcastFeedbackAfterClickMode(feedbackButton) ===
                    'replace',
                }),
                'broadcast:wizard:feedback:after:replace',
              ),
            ],
            ...(getBroadcastFeedbackAfterClickMode(feedbackButton) === 'replace'
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

    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionSelectGroup, {
            actionButton: selectGroup,
          }),
          'broadcast:wizard:actions:select-group:toggle',
        ),
      ],
      ...(selectGroup
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionSelectGroupText),
                'broadcast:wizard:actions:select-group:text',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionAuth, {
            actionButton: auth,
          }),
          'broadcast:wizard:actions:auth:toggle',
        ),
      ],
      ...(auth
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionAuthText),
                'broadcast:wizard:actions:auth:text',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionStart, {
            actionButton: start,
          }),
          'broadcast:wizard:actions:start:toggle',
        ),
      ],
      ...(start
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionStartText),
                'broadcast:wizard:actions:start:text',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionUnsubscribe, {
            actionButton: unsubscribe,
          }),
          'broadcast:wizard:actions:unsubscribe:toggle',
        ),
      ],
      ...(unsubscribe
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionUnsubscribeText),
                'broadcast:wizard:actions:unsubscribe:text',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionLink, {
            actionButton: link,
          }),
          'broadcast:wizard:actions:link:toggle',
        ),
      ],
      ...(link
        ? [
            [
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionLinkText),
                'broadcast:wizard:actions:link:text',
              ),
              Markup.button.callback(
                ctx.i18n.t(LocalePhrase.Button_Broadcast_ActionLinkUrl),
                'broadcast:wizard:actions:link:url',
              ),
            ],
          ]
        : []),
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_BackToSettings),
          'broadcast:wizard:actions:back',
        ),
      ],
    ]);
  }

  public getBroadcastActivityFilterMenu(
    ctx: IContext,
    includeNoActivity: boolean,
  ) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          'Был активен до даты',
          'broadcast:wizard:filter:activity:before',
        ),
      ],
      [
        Markup.button.callback(
          'Был активен с даты',
          'broadcast:wizard:filter:activity:after',
        ),
      ],
      [
        Markup.button.callback(
          'Был активен в диапазоне',
          'broadcast:wizard:filter:activity:range',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterActivityIncludeNoActivity,
            { includeNoActivity },
          ),
          'broadcast:wizard:filter:activity:include-no-activity',
        ),
      ],
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterGroupsClear),
          'broadcast:wizard:filter:activity:clear',
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

  public getBroadcastActionTextPrompt(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          'broadcast:wizard:actions:settings',
        ),
      ],
    ]);
  }

  public getBroadcastForwardKeyboardMessageTextPrompt(ctx: IContext) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          'broadcast:wizard:forward-keyboard:back',
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
    return this.baseKeyboardFactory.getPagination({
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

  public getBroadcastRateLimitCampaignsSelector(params: {
    ctx: IContext;
    items: { id: number; title: string }[];
    currentPage: number;
    totalPages: number;
  }) {
    return this.baseKeyboardFactory.getPagination({
      name: 'broadcast-filter-rate-limit-campaigns',
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      items: params.items.map((item) => ({
        title: item.title,
        payload: String(item.id),
      })),
      actionPrefix: 'broadcast:wizard:filter:rate-limit:select:',
      additionalButtons: [
        Markup.button.callback(
          params.ctx.i18n.t(LocalePhrase.Button_Broadcast_Back),
          'broadcast:wizard:filters',
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
      onlyAuthorized?: boolean;
      hasActivityFilter: boolean;
      hasExcludedCampaigns: boolean;
      hasRetryRateLimitCampaign: boolean;
    },
  ) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Broadcast_FilterAuthorized, params),
          'broadcast:wizard:filter:authorized',
        ),
        Markup.button.callback(
          ctx.i18n.t(
            LocalePhrase.Button_Broadcast_FilterRetryRateLimit,
            params,
          ),
          'broadcast:wizard:filter:rate-limit',
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
}
