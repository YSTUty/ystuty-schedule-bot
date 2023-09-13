import {
  Context as VKContext,
  MessageContext as VKMessageContext,
  MessageEventContext as VKMessageEventContext,
} from 'vk-io';
import { I18nContext } from 'vk-io-i18n';
import { IStepContext as IVKStepContext, SceneContext } from '@vk-io/scenes';
import { ISessionContext } from '@vk-io/session';
import { UserInfo } from '@my-interfaces';

export interface ISessionState {
  __language_code?: string;
  __scene?: { current: string };

  selectedGroupName?: string;
  socialConnectLink?: string;

  user?: UserInfo;
}

interface ISessionConversationState {
  selectedGroupName?: string;
  hideStaticKeyboard?: boolean;
}

type ContextState = {
  appeal: boolean;
  foundGroupName?: string;
  rejectRefGroupName?: boolean;

  [key: string]: any;
};

type CombinedContext = {
  readonly i18n: I18nContext;
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
