import {
  API,
  Context as VKContext,
  MessageContext as VKMessageContext,
  MessageEventContext as VKMessageEventContext,
} from 'vk-io';
import { I18nContext } from 'vk-io-i18n';
import { IStepContext as IVKStepContext, SceneContext } from '@vk-io/scenes';
import { ISessionContext } from '@vk-io/session';

import { UserSocial } from '../../models/user/entity/user-social.entity';
import { User } from '../../models/user/entity/user.entity';

export interface ISessionState {
  __language_code?: string;
  __scene?: { current: string };

  socialConnectLink?: string;
}

interface ISessionConversationState {
  // // TODO: remove it. Use `conversation.groupName`
  selectedGroupName?: string;
  hideStaticKeyboard?: boolean;
}

type ContextState = {
  appeal: boolean;

  userSocial: UserSocial;
  user?: User;

  foundGroupName?: string;
  rejectRefGroupName?: boolean;

  [key: string]: any;
};

type CombinedContext = {
  readonly i18n: I18nContext;
  readonly api: API;
} & {
  scene: SceneContext<Record<string, any>>;
  session: ISessionContext & ISessionState;
  sessionConversation: ISessionContext & ISessionConversationState;
} & {};

export type IContext<T = {}> = VKContext<{}, ContextState> &
  CombinedContext &
  T;
export type IMessageContext = VKMessageContext<ContextState> & CombinedContext;
export type IMessageEventContext = VKMessageEventContext<ContextState> &
  CombinedContext;
export type IStepContext<S extends Record<string, unknown> = any> =
  IVKStepContext<S> & (IMessageContext | IMessageEventContext);
