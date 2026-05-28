import type {
  IContext as IVKSceneContext,
  IStepContext as IVKStepContext,
} from '@vk-io/scenes';
import type { ISessionContext } from '@vk-io/session';
import type {
  API,
  Context as VKContext,
  MessageContext as VKMessageContext,
  MessageEventContext as VKMessageEventContext,
} from 'vk-io';
import type { I18nContext } from 'vk-io-i18n';

import type { Conversation } from '../../models/social/entity/conversation.entity';
import type { UserSocial } from '../../models/user/entity/user-social.entity';
import type { User } from '../../models/user/entity/user.entity';

export interface ISessionState {
  __language_code?: string;
  __scene?: { current: string };

  socialConnectLink?: string;
}

interface ISessionConversationState {
  // TODO: remove it. Use `conversation.groupName`
  /** @deprecated Use `conversation.groupName` */
  selectedGroupName?: string;
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
} & {};

export type IContext<T = {}> = VKContext<{}, ContextState> &
  CombinedContext &
  T;
export type IMessageContext = VKMessageContext<ContextState> & CombinedContext;
export type IMessageEventContext = VKMessageEventContext<ContextState> &
  CombinedContext & { $match: RegExpMatchArray };
export type IStepContext<S extends Record<string, unknown> = any> =
  IVKStepContext<S> & (IMessageContext | IMessageEventContext);
