import {
  LocalePhrase,
  type LocalePhraseType,
  TelegramLocalePhrase,
} from './locale.interface';

type LocaleUserTemplate = {
  login: string;
  fullname: string;
  groupName?: string | null;
  isRewoked?: boolean;
};

type LocaleTeacherTemplate = { name: string };

type LocaleScheduleNotifTemplate = {
  targetId: string;
  deliveryHour: number;
  deliveryMinute: number;
  targetDayOffset: number;
  weekdaysLabel: string;
  isEnabled: boolean;
};

type LocaleBroadcastFilterTemplate = {
  hasDM?: boolean;
  isBlockedBot?: boolean;
  onlyAuthorized?: boolean;
  groupNames?: string[];
};

type LocaleFeedbackButtonTemplate = {
  text: string;
  responseText?: string | null;
};

type LocaleBroadcastCampaignTemplate = {
  id: number;
  status: string;
  mode: string;
  contentPreview?: string | null;
  settingsVersion?: number;
  audienceFilter: {
    onlyAuthorized?: boolean;
    groupName?: string | null;
    groupNames?: string[];
    lastInteractionAfter?: string | null;
    lastInteractionBefore?: string | null;
    excludeCampaignIds?: number[];
  };
  feedbackButton?: LocaleFeedbackButtonTemplate | null;
  actionKeyboard?: Array<{ type: string }> | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: Date;
};

type LocaleCampaignListItemTemplate = {
  id: number;
  status: string;
  sentCount: number;
  totalCount: number;
  createdAt: Date;
};

type LocaleQueueStatusTemplate = {
  active: number;
  waiting: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: boolean;
};

/**
 * Параметры шаблонов, которые интерполируются в локали обоих transport.
 *
 * `compile-template` не знает о TypeScript и сообщает о пропущенном ключе
 * только во время обработки сообщения. Эта карта переносит контракт таких
 * ключей в типы `ctx.i18n.t`.
 */
export type LocalePhraseParams = {
  [LocalePhrase.Button_Schedule_PreviousWeek]: { weekNumber: number };
  [LocalePhrase.Button_Schedule_NextWeek]: { weekNumber: number };
  [LocalePhrase.Button_SelectGroup_X]: { groupName: string };
  [LocalePhrase.Button_Broadcast_DeleteSelected]: { selectedCount: number };
  [LocalePhrase.Button_Broadcast_ModeToggle]: {
    mode: string;
    nextMode: string;
  };
  [LocalePhrase.Button_Broadcast_FilterAuthorized]: {
    onlyAuthorized?: boolean;
  };
  [LocalePhrase.Button_Broadcast_FilterGroup]: { groupName: string };
  [LocalePhrase.Button_Broadcast_FilterGroups]: { hasGroups: boolean };
  [LocalePhrase.Button_Broadcast_FilterInstituteToggle]: { selected: boolean };
  [LocalePhrase.Button_Broadcast_FilterActivity]: {
    hasActivityFilter: boolean;
  };
  [LocalePhrase.Button_Broadcast_FilterActivityIncludeNoActivity]: {
    includeNoActivity: boolean;
  };
  [LocalePhrase.Button_Broadcast_FilterExcludeCampaigns]: {
    hasExcludedCampaigns: boolean;
  };
  [LocalePhrase.Button_Broadcast_FilterExcludeCampaignsDone]: {
    selectedCount: number;
  };
  [LocalePhrase.Button_Broadcast_FilterRetryRateLimit]: {
    hasRetryRateLimitCampaign: boolean;
  };
  [LocalePhrase.Button_Broadcast_FeedbackToggle]: {
    feedbackButton?: LocaleFeedbackButtonTemplate | null;
  };
  [LocalePhrase.Button_Broadcast_FeedbackAfterDelete]: { selected: boolean };
  [LocalePhrase.Button_Broadcast_FeedbackAfterKeep]: { selected: boolean };
  [LocalePhrase.Button_Broadcast_FeedbackAfterReplace]: { selected: boolean };
  [LocalePhrase.Button_Broadcast_ActionButtons]: {
    actionButtonsCount: number;
  };
  [LocalePhrase.Button_Broadcast_ActionSelectGroup]: {
    actionButton: object | undefined;
  };
  [LocalePhrase.Button_Broadcast_ActionAuth]: {
    actionButton: object | undefined;
  };
  [LocalePhrase.Button_Broadcast_ActionStart]: {
    actionButton: object | undefined;
  };
  [LocalePhrase.Button_Broadcast_ActionUnsubscribe]: {
    actionButton: object | undefined;
  };
  [LocalePhrase.Button_Broadcast_ActionLink]: {
    actionButton: object | undefined;
  };

  [LocalePhrase.Page_Auth_Done]: { user: LocaleUserTemplate };
  [LocalePhrase.Page_SocialConnect_NeedConnect]: { botName: string };
  [LocalePhrase.Page_SocialConnect_WaitConfirm]: { botName: string };
  [LocalePhrase.Page_SocialConnect_AlreadySent]: { botName: string };
  [LocalePhrase.Page_Profile_Info]: { user: LocaleUserTemplate };

  [LocalePhrase.Page_Schedule_NearestSchedule]: {
    days: number;
    content: string;
  };
  [LocalePhrase.Page_Schedule_NotFoundDate]: { date: string };
  [LocalePhrase.Page_Schedule_NotFoundWeek]: { dateRange: string };
  [LocalePhrase.Page_Schedule_TeachersList]: {
    currentPage: number;
    totalPages: number;
    query: string;
  };
  [LocalePhrase.Page_Schedule_TeacherSelected]: {
    teacher: LocaleTeacherTemplate;
  };
  [LocalePhrase.Page_Schedule_TeacherNotFound]: { query: string | number };
  [LocalePhrase.Page_Schedule_WeekTitle]: {
    weekNumber: number;
    dateRange: string;
    isNextWeek: boolean;
    /** Пока дальние недели не реализованы, передаётся как `null`. */
    weekTitle: string | null;
  };
  [LocalePhrase.Page_Schedule_TeacherWeekTitle]: {
    weekNumber: number;
    dateRange: string;
    isNextWeek: boolean;
    /** Пока дальние недели не реализованы, передаётся как `null`. */
    weekTitle: string | null;
  };
  [LocalePhrase.Page_Schedule_WeekTitle_Past]: { weeks: number };
  [LocalePhrase.Page_Schedule_WeekTitle_Future]: { weeks: number };

  [LocalePhrase.Page_ScheduleNotif_Settings]: {
    notif: LocaleScheduleNotifTemplate | null | undefined;
  };
  [LocalePhrase.Page_ScheduleNotif_ConfirmDelete]: { groupName: string };

  [LocalePhrase.Page_Feedback_Submitted]: { feedbackId: number };
  [LocalePhrase.Page_Feedback_DeliveryPending]: { feedbackId: number };

  [LocalePhrase.Page_SelectGroup_Current]: { groupName: string };
  [LocalePhrase.Page_SelectGroup_InstitutesList]: {
    currentPage: number;
    totalPages: number;
  };
  [LocalePhrase.Page_SelectGroup_GroupsList]: {
    currentPage: number;
    totalPages: number;
    instituteName?: string;
  };
  [LocalePhrase.Page_SelectGroup_Selected]: { selectedGroupName: string };
  [LocalePhrase.Page_SelectGroup_NotFound]: { groupName: string | undefined };
  [LocalePhrase.Page_SelectGroup_EnterNameWithExample]: {
    randomGroupName: string;
    randomGroupName2: string;
  };

  [LocalePhrase.Page_Broadcast_Settings]: {
    recipientsCount: number;
    audienceMode: string;
    selectedCount: number;
    selectedRecipientIds: number[];
    filter: LocaleBroadcastFilterTemplate;
    feedbackButton?: LocaleFeedbackButtonTemplate | null;
    feedbackAfterClickSummary?: string;
    actionKeyboardSummary: string;
    /** Используется Telegram-вариантом экрана. */
    mode?: string;
    /** Используется VK-вариантом экрана. */
    actionKeyboard?: Array<{ type: string }> | null;
  };
  [LocalePhrase.Page_Broadcast_SelectRecipients]: {
    selectedCount: number;
    currentPage: number;
    totalPages: number;
  };
  [LocalePhrase.Page_Broadcast_Ready]: {
    recipientsCount: number;
    selectedCount: number;
    mode?: string;
    hasRecipientKeyboard?: boolean;
    forwardKeyboardMessageText?: string;
  };
  [LocalePhrase.Page_Broadcast_Queued]: {
    campaignId: number;
    recipientsCount: number;
  };
  [LocalePhrase.Page_Broadcast_AlreadyActive]: {
    campaign?: Pick<LocaleBroadcastCampaignTemplate, 'id'> | null;
  };
  [LocalePhrase.Page_Broadcast_FilterGroup]: {
    groupName?: string | null;
  };
  [LocalePhrase.Page_Broadcast_Filters]: {
    recipientsCount: number;
    filter: LocaleBroadcastFilterTemplate;
    groupsCount: number;
    /** VK выводит перечисление групп, Telegram — только их число. */
    groupsText?: string;
    activityText: string | null;
    excludeCampaignIds: number[];
    retryRateLimitCampaignId?: number | null;
  };
  [LocalePhrase.Page_Broadcast_FilterRetryRateLimit]: {
    retryRateLimitCampaignId?: number | null;
    currentPage: number;
    totalPages: number;
  };
  [LocalePhrase.Page_Broadcast_FilterInstitutes]: {
    currentPage: number;
    totalPages: number;
  };
  [LocalePhrase.Page_Broadcast_FilterGroups]: {
    instituteName?: string;
    selectedGroupsCount: number;
    currentPage: number;
    totalPages: number;
  };
  [LocalePhrase.Page_Broadcast_FilterGroupsList]: { groupNames: string };
  [LocalePhrase.Page_Broadcast_ActionSettings]: {
    actionKeyboardSummary: string;
  };
  [LocalePhrase.Page_Broadcast_FilterExcludeCampaigns]: {
    selectedCampaignIds: number[];
    currentPage: number;
    totalPages: number;
  };
  [LocalePhrase.Page_Broadcast_QueueStatus]: {
    status: LocaleQueueStatusTemplate;
  };
  [LocalePhrase.Page_Broadcast_CampaignsList]: {
    items: LocaleCampaignListItemTemplate[];
  };
  [LocalePhrase.Page_Broadcast_CampaignDetails]: {
    campaign: LocaleBroadcastCampaignTemplate;
  };
  [LocalePhrase.Page_Broadcast_CampaignDeleted]: {
    campaignId: number;
    deletedCount: number;
    failedCount: number;
    remainingCount: number;
  };
  [LocalePhrase.Page_Broadcast_CampaignDeleteConfirm]: { campaignId: number };
  [LocalePhrase.Page_Broadcast_CampaignDeleteSelector]: {
    campaignId: number;
    selectedCount: number;
    currentPage: number;
    totalPages: number;
  };
  [LocalePhrase.Page_Broadcast_FeedbackSettings]: {
    feedbackButton: LocaleFeedbackButtonTemplate;
    feedbackAfterClickSummary: string;
  };
  [LocalePhrase.Page_Broadcast_CampaignNotFound]: { campaignId: number };
  [LocalePhrase.Page_Broadcast_Progress]: {
    campaignId: number;
    doneCount: number;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    status: string;
  };

  [LocalePhrase.Broadcast_Notification_ModeChanged]: { mode: string };

  [TelegramLocalePhrase.Page_Schedule_Title_ForToday]: { groupName: string };
  [TelegramLocalePhrase.Page_Schedule_Title_ForTomorrow]: { groupName: string };
  [TelegramLocalePhrase.Page_Schedule_Title_ForWeek]: { groupName: string };
  [TelegramLocalePhrase.Page_Schedule_Title_ForNextWeek]: { groupName: string };
};

type LocaleTemplateArgs<Phrase extends LocalePhraseType> =
  Phrase extends keyof LocalePhraseParams
    ? [templateData: Readonly<LocalePhraseParams[Phrase]>]
    : [templateData?: Readonly<Record<string, unknown>>];

/** Одинаковая типизированная поверхность i18n для Telegram и VK. */
export type LocaleI18nContext = {
  t<Phrase extends LocalePhraseType>(
    phrase: Phrase,
    ...args: LocaleTemplateArgs<Phrase>
  ): string;
};
