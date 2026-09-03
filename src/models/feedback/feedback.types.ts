import { SocialType } from '@my-common/constants';

/** Категория отзыва, выбранная пользователем перед отправкой. */
export enum FeedbackCategory {
  Schedule = 'schedule',
  Bot = 'bot',
  Suggestion = 'suggestion',
  Other = 'other',
}

export enum FeedbackDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Partial = 'partial',
  Failed = 'failed',
}

/** Состояние доставки feedback одному конкретному администратору. */
export enum FeedbackAdminDeliveryStatus {
  Pending = 'pending',
  Retrying = 'retrying',
  Sent = 'sent',
  Failed = 'failed',
}

/** Исходное сообщение, которое будет переслано администраторам. */
export type FeedbackSourceMessage = {
  messageId: number;
  /** Первое добавленное сообщение — основное; остальные дополняют отзыв. */
  isPrimary?: boolean;
  conversationMessageId?: number;
  text?: string;
  attachments?: FeedbackAttachment[];
};

/** JSON-снимок вложения, достаточный для аудита без хранения файла. */
export type FeedbackAttachment = {
  type: string;
  payload: object;
};

export type FeedbackContent = {
  messages: FeedbackSourceMessage[];
};

export type CreateFeedbackParams = {
  userSocialId: number;
  social: SocialType;
  category: FeedbackCategory;
  sourcePeerId: string;
  content: FeedbackContent;
};
