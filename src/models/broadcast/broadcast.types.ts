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
  Sent = 'sent',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum BroadcastMessageMode {
  Copy = 'copy',
  Forward = 'forward',
  Text = 'text',
}

export type BroadcastAudienceFilter = {
  hasDM?: boolean;
  isBlockedBot?: boolean;
  onlyAuthorized?: boolean;
  /** @deprecated Используется только для чтения кампаний, созданных до группового фильтра. */
  groupName?: string | null;
  /** `undefined` — без ограничения по группе, пустой массив — намеренно пустая выборка. */
  groupNames?: string[];
  /** Оставляет пользователей, взаимодействовавших с ботом не раньше указанной даты. */
  lastInteractionAfter?: string | null;
  /** Исключает пользователей, для которых создавалась delivery указанных кампаний. */
  excludeCampaignIds?: number[];
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
  /** Если задан, заменяет кнопку после первого клика вместо её удаления. */
  afterClickText?: string | null;
};

/** Состояние callback-кнопки feedback. */
export type BroadcastFeedbackAction = 'initial' | 'repeat';

/** Предустановленное действие, которое transport добавляет к сообщению рассылки. */
export type BroadcastActionKeyboard = {
  type: 'select_group';
  /** Необязательная подпись вместо локализованной подписи действия по умолчанию. */
  text?: string | null;
};

export type BroadcastRecipientAction = BroadcastActionKeyboard['type'];

export type BroadcastJobData = {
  campaignId: number;
  deliveryId: number;
  social: SocialType;
  targetSocialId: string;
};

export type BroadcastTransportResult = {
  messageId?: string | null;
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
