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
    targetSocialId: string;
    mode: BroadcastMessageMode;
    sourceMessage: BroadcastSourceMessage;
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
