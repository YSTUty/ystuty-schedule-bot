import {
    Context as VKContext,
    MessageContext as VKMessageContext,
} from 'vk-io';
import { I18nContext } from 'vk-io-i18n';
import { IStepContext as IVKStepContext } from '@vk-io/scenes';
import { ISessionContext } from '@vk-io/session';

interface ISessionState {
    selectedGroupName?: string;
}
interface ISessionConversationState {
    selectedGroupName?: string;
    hideStaticKeyboard?: boolean;
}

type ContextState = {
    appeal: boolean;
    [key: string]: any;
};

type CombinedContext = {
    readonly i18n: I18nContext;
} & {
    session: ISessionContext & ISessionState;
    sessionConversation: ISessionContext & ISessionConversationState;
} & {};

export type IContext<T = {}> = VKContext<{}, ContextState> &
    CombinedContext &
    T;
export type IMessageContext = VKMessageContext<ContextState> & CombinedContext;
export type IStepContext = IVKStepContext & IMessageContext;
