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
  groupName?: string | null;
  profileType?: string | null;
  userSocialIds?: number[];
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
    text: string;
  }): Promise<boolean>;
}
