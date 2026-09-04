import { SocialType } from '@my-common/constants';

export enum BroadcastCampaignStatus {
  Draft = 'draft',
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Terminated = 'terminated',
}

export enum BroadcastDeliveryStatus {
  Queued = 'queued',
  Retrying = 'retrying',
  Sent = 'sent',
  Failed = 'failed',
  Skipped = 'skipped',
}

/** Причина terminal delivery error для фильтров и короткой статистики кампании. */
export enum BroadcastDeliveryFailureKind {
  RateLimit = 'rate_limit',
  BlockedBot = 'blocked_bot',
  Deactivated = 'deactivated',
  Unavailable = 'unavailable',
  Other = 'other',
}

export enum BroadcastMessageMode {
  Copy = 'copy',
  Forward = 'forward',
  Text = 'text',
}

export type BroadcastAudienceFilter = {
  hasDM?: boolean;
  isBlockedBot?: boolean;
  /** `undefined` — любой статус, `true` — привязанный ЯГТУ.ID, `false` — без привязки. */
  onlyAuthorized?: boolean;
  /** @deprecated Используется только для чтения кампаний, созданных до группового фильтра. */
  groupName?: string | null;
  /** `undefined` — без ограничения по группе, пустой массив — намеренно пустая выборка. */
  groupNames?: string[];
  /** Нижняя включительная граница активности в UTC. */
  lastInteractionAfter?: string | null;
  /** Верхняя исключающая граница активности в UTC. */
  lastInteractionBefore?: string | null;
  /** Включает профили без входящего сообщения вместе с выбранным диапазоном активности. */
  includeNoActivity?: boolean;
  /** Исключает пользователей, для которых создавалась delivery указанных кампаний. */
  excludeCampaignIds?: number[];
  /**
   * Оставляет только получателей, у которых указанная кампания не доставилась
   * из-за Telegram rate limit. Используется для аккуратного повторного запуска.
   */
  retryRateLimitCampaignId?: number | null;
  profileType?: string | null;
  userSocialIds?: number[];
};

export type BroadcastAudienceGroup = {
  groupName: string;
  recipientsCount: number;
};

export type BroadcastAudienceInstitute = {
  instituteName: string;
  recipientsCount: number;
  groups: BroadcastAudienceGroup[];
};

export type BroadcastAudienceGroupsPreview = {
  recipientsCount: number;
  selectedRecipientsCount: number;
  institutes: BroadcastAudienceInstitute[];
};

export type BroadcastSourceMessage = {
  chatId?: number;
  messageId?: number;
  text?: string;
  /** Текст отдельного сообщения с inline-клавиатурой после Telegram-forward. */
  recipientKeyboardMessageText?: string;
  attachment?: string;
  stickerId?: number;
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  reportMessage?: {
    chatId: number;
    messageId: number;
    lastUpdatedAt?: number;
    lastDoneCount?: number;
  };
};

/** Настройка одной кнопки обратной связи под сообщением рассылки. */
export type BroadcastFeedbackButton = {
  text: string;
  /** Текст snackbar/notification после нажатия; без него используется стандартный ответ. */
  responseText?: string | null;
  /** Поведение feedback-кнопки после первого клика. */
  afterClickMode?: BroadcastFeedbackAfterClickMode | null;
  /** Текст кнопки для режима `replace`. */
  afterClickText?: string | null;
};

export type BroadcastFeedbackAfterClickMode = 'delete' | 'keep' | 'replace';

/** Поддерживает кампании, созданные до появления явного режима после клика. */
export const getBroadcastFeedbackAfterClickMode = (
  feedbackButton?: BroadcastFeedbackButton | null,
): BroadcastFeedbackAfterClickMode => {
  if (
    feedbackButton?.afterClickMode === 'delete' ||
    feedbackButton?.afterClickMode === 'keep' ||
    feedbackButton?.afterClickMode === 'replace'
  ) {
    return feedbackButton.afterClickMode;
  }

  return feedbackButton?.afterClickText ? 'replace' : 'delete';
};

/** Состояние callback-кнопки feedback. */
export type BroadcastFeedbackAction = 'initial' | 'repeat';

/** Предустановленная дополнительная кнопка для получателя рассылки. */
export type BroadcastRecipientActionButton = {
  type: BroadcastRecipientAction;
  /** Необязательная подпись вместо локализованной подписи действия по умолчанию. */
  text?: string | null;
};

/** Произвольная внешняя ссылка под сообщением рассылки. */
export type BroadcastLinkButton = {
  type: 'link';
  text: string;
  url: string;
};

/** Набор transport-независимых дополнительных кнопок получателя. */
export type BroadcastActionKeyboard = Array<
  BroadcastRecipientActionButton | BroadcastLinkButton
>;

export type BroadcastRecipientAction =
  | 'select_group'
  | 'auth'
  | 'start'
  | 'unsubscribe';

/** Набор параметров кампании, пригодный для повторного использования в wizard. */
export type BroadcastCampaignSettings = {
  settingsVersion: number;
  mode: BroadcastMessageMode;
  audienceFilter: BroadcastAudienceFilter;
  feedbackButton: BroadcastFeedbackButton | null;
  actionKeyboard: BroadcastActionKeyboard;
};

export type BroadcastCampaignSettingsReuse =
  | { compatible: true; settings: BroadcastCampaignSettings }
  | { compatible: false; settingsVersion: number };

/** Приводит сохранённую настройку к безопасному набору кнопок, включая прежний JSONB-формат. */
export const normalizeBroadcastActionKeyboard = (
  value?: BroadcastActionKeyboard | BroadcastRecipientActionButton | null,
): BroadcastActionKeyboard => {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<BroadcastRecipientAction | 'link'>();
  const result: BroadcastActionKeyboard = [];

  for (const item of items) {
    if (!item || seen.has(item.type)) continue;

    if (item.type === 'link') {
      const text =
        typeof item.text === 'string' ? item.text.trim().slice(0, 40) : '';
      const url = normalizeBroadcastLinkUrl(item.url);
      if (!text || !url) continue;
      seen.add(item.type);
      result.push({ type: item.type, text, url });
      continue;
    }

    if (
      (item.type !== 'select_group' &&
        item.type !== 'auth' &&
        item.type !== 'start' &&
        item.type !== 'unsubscribe') ||
      seen.has(item.type)
    ) {
      continue;
    }
    seen.add(item.type);

    result.push({
      type: item.type,
      ...(typeof item.text === 'string' && item.text.trim()
        ? { text: item.text.trim().slice(0, 40) }
        : {}),
    });
  }

  return result;
};

/** Разрешает только абсолютные HTTP(S)-ссылки для URL-кнопки рассылки. */
export const normalizeBroadcastLinkUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return value.trim();
  } catch {
    return null;
  }
};

export type BroadcastJobData = {
  campaignId: number;
  deliveryId: number;
  social: SocialType;
  targetSocialId: string;
};

export type BroadcastTransportResult = {
  messageId?: string | null;
};

/**
 * Хранит один или несколько идентификаторов сообщений в существующем поле
 * доставки без изменения схемы БД. Старые одиночные значения остаются
 * совместимыми.
 */
export const serializeBroadcastDeliveryMessageIds = (messageIds: string[]) =>
  messageIds.length === 1 ? messageIds[0] : JSON.stringify(messageIds);

/** Читает старый одиночный ID либо JSON-массив ID сообщений одной доставки. */
export const parseBroadcastDeliveryMessageIds = (value: string): string[] => {
  try {
    const messageIds = JSON.parse(value);
    if (
      Array.isArray(messageIds) &&
      messageIds.every(
        (messageId): messageId is string =>
          typeof messageId === 'string' && /^\d+$/.test(messageId),
      )
    ) {
      return messageIds;
    }
  } catch {
    // Старый формат хранит одиночный ID обычной строкой.
  }

  return /^\d+$/.test(value) ? [value] : [];
};

export interface BroadcastTransport {
  readonly social: SocialType;

  sendCampaignDelivery(params: {
    campaignId: number;
    deliveryId: number;
    targetSocialId: string;
    mode: BroadcastMessageMode;
    sourceMessage: BroadcastSourceMessage;
    actionKeyboard?: BroadcastActionKeyboard | null;
    feedbackButton?: BroadcastFeedbackButton | null;
  }): Promise<BroadcastTransportResult>;

  deleteCampaignDelivery(params: {
    targetSocialId: string;
    messageId: string;
  }): Promise<boolean>;

  updateCampaignProgress?(params: {
    reportMessage: NonNullable<BroadcastSourceMessage['reportMessage']>;
    status: BroadcastCampaignStatus;
    paused: boolean;
    text: string;
  }): Promise<boolean>;
}
