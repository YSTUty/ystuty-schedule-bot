import type {
  IContext as IVKSceneContext,
  IStepContext as IVKStepContext,
} from '@vk-io/scenes';
import type { ISessionContext } from '@vk-io/session';
import type {
  API,
  IMessageContextSendOptions,
  MessageSource,
  Context as VKContext,
  MessageContext as VKMessageContext,
  MessageEventContext as VKMessageEventContext,
  MessageSubscriptionContext as VKMessageSubscriptionContext,
} from 'vk-io';
import type { I18nContext } from 'vk-io-i18n';

import type { Conversation } from '../../models/social/entity/conversation.entity';
import type { UserSocial } from '../../models/user/entity/user-social.entity';
import type { User } from '../../models/user/entity/user.entity';

export interface ISessionState {
  __language_code?: string;
  __scene?: { current: string };

  socialConnectLink?: string;
  teacherId?: number;
}

interface ISessionConversationState {
  hideStaticKeyboard?: boolean;
}

type ContextState = {
  appeal: boolean;
  eventAnswered?: boolean;
  isLocalePhrase?: boolean;

  noUpdateUserSocial?: boolean;
  userSocial: UserSocial;
  user?: User | null;
  conversation?: Conversation | null;

  rejectRefGroupName?: boolean;
  foundGroupName?: string;

  // [key: string]: any;
};

type CombinedContext = {
  readonly i18n: I18nContext;
  readonly api: API;
} & {
  session: ISessionContext & ISessionState;
  sessionConversation: ISessionContext & ISessionConversationState;
  scene: IVKSceneContext['scene'];

  peerId: number; // * force set (в mw скипаем, если его нету)
  // * redefined vk-io ctx features
  peerType: MessageSource.USER | MessageSource.CHAT | MessageSource.GROUP;
  isDM: boolean;
  isChat: boolean;
  chatId?: number;

  /** Проверяет, является ли текущий update callback-событием VK. */
  isMessageEventContext: () => this is IMessageEventContext;
  isMessageContext: () => this is IMessageContext;
  /** Проверяет, является ли текущий update изменением разрешения на сообщения. */
  isMessageSubscriptionContext: () => this is IMessageSubscriptionContext;
  /** Редактирует исходное callback-сообщение или ничего не делает вне message_event. */
  editMessage: (
    params: Pick<IMessageContextSendOptions, 'keyboard' | 'message'>,
  ) => Promise<unknown>;
} & {};

export type IContext<T = {}> = VKContext<{}, ContextState> &
  CombinedContext &
  T;
export type IMessageContext = VKMessageContext<ContextState> & CombinedContext;
export type IMessageEventContext = VKMessageEventContext<ContextState> &
  CombinedContext & { $match: RegExpMatchArray };
export type IMessageSubscriptionContext =
  VKMessageSubscriptionContext<ContextState> & CombinedContext;
export type IStepContext<S extends Record<string, unknown> = any> =
  IVKStepContext<S> & (IMessageContext | IMessageEventContext);
