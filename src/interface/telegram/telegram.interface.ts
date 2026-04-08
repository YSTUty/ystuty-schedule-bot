import { Context, NarrowedContext, Scenes } from 'telegraf';
import type { ParseMode, Update } from 'telegraf/types';
import type {
  SceneSessionData,
  WizardContext,
  WizardContextWizard,
  WizardSessionData,
} from 'telegraf/typings/scenes';
import type * as tt from 'telegraf/typings/telegram-types';
import type ApiClient from 'telegraf/typings/core/network/client';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';
import type Telegram from 'telegraf/typings/telegram';
import { I18nContext } from '@esindger/telegraf-i18n';
import { LocalePhrase, TelegramLocalePhrase } from '@my-interfaces';

import { UserSocial } from '../../models/user/entity/user-social.entity';
import { User } from '../../models/user/entity/user.entity';
import { Conversation } from '../../models/social/entity/conversation.entity';

export type NextFn = (...args: any[]) => Promise<any>;
export type AnyObj = Record<string, unknown>;
export type Tail<T> = T extends [unknown, ...infer U] ? U : never;
type Shorthand<FName extends Exclude<keyof Telegram, keyof ApiClient>> = Tail<
  Parameters<Telegram[FName]>
>;

interface ISessionState {
  __language_code?: string;
  __scenes?: { current?: string; state?: any; cursor?: number };

  teacherId?: number;
}

interface ISessionConversationState {
  // TODO: remove it. Use `conversation.groupName`
  /** @deprecated Use `conversation.groupName` */
  selectedGroupName?: string;
}

type SceneSession = {
  state: any;
} & SceneSessionData;

type WizardSession = {
  state: any;
} & WizardSessionData;

type ContextState = {
  appeal: boolean;
  isLocalePhrase?: boolean;
  // [key: string]: any;
};

type CombinedContext = {
  session: ISessionState;
  sessionConversation: ISessionConversationState;

  match?: RegExpExecArray;

  noUpdateUserSocial?: boolean;
  userSocial: UserSocial;
  user?: User;
  conversation?: Conversation;

  state: ContextState;

  scene: Scenes.SceneContextScene<
    Scenes.SceneContext<SceneSession>,
    SceneSession
  > & { state: any };

  i18n: I18nContext<
    Record<LocalePhrase | TelegramLocalePhrase, Record<string, unknown> | never>
  >;
  tryAnswerCbQuery: (
    ...args: Shorthand<'answerCbQuery'>
  ) => Promise<true | null>;
  assert<T extends string | number | object>(
    value: T | undefined,
    method: string,
  ): asserts value is T;

  /**
   * Use this method to stream a partial message to a user while the message is being generated. Returns True on success.
   *
   * ~~@param chat_id Unique identifier for the target private chat~~
   * @param draft_id Unique identifier of the message draft; must be non-zero. Changes of drafts with the same identifier are animated
   * @param text Text of the message to be sent, 1-4096 characters after entities parsing
   * ~~@param other Optional remaining parameters, confer the official reference below~~
   * ~~@param signal Optional `AbortSignal` to cancel the request~~
   *
   * **Official reference:** https://core.telegram.org/bots/api#sendmessagedraft
   */
  sendMessageDraft(
    // chat_id: number,
    draft_id: number,
    text: string,
    extra?: {
      /** Mode for parsing entities in the message text. See formatting options for more details. */
      parse_mode?: ParseMode;
      /** Unique identifier for the target message thread */
      message_thread_id?: number;
      /** A JSON-serialized list of special entities that appear in message text, which can be specified instead of parse_mode */
      entities?: any[];
    },
  ): Promise<boolean>;

  sendStreamingMessage(
    text: string,
    extra?: {
      parse_mode?: ParseMode;
      chunkDelay?: number;
      gap?: number;
      htmlAwareSplit?: boolean;
      replyToMessageId?: number;
    },
  ): Promise<any>;
};

export type IContext<
  T = {},
  U extends Deunionize<Update> = Update,
> = CombinedContext & Context<U> & T;

export type INarrowedContext<T = {}> = NarrowedContext<
  never,
  tt.MountMap['text']
> &
  CombinedContext &
  T;

export interface CommandContextExtn {
  /**
   * Matched command. This will always be the actual command, excluding preceeding slash and `@botname`
   *
   * Examples:
   * ```
   * /command abc -> command
   * /command@xyzbot abc -> command
   * ```
   */
  command: string;
  /**
   * The unparsed payload part of the command
   *
   * Examples:
   * ```
   * /command abc def -> "abc def"
   * /command "token1 token2" -> "\"token1 token2\""
   * ```
   */
  payload: string;
  /**
   * Command args parsed into an array.
   *
   * Examples:
   * ```
   * /command token1 token2 -> [ "token1", "token2" ]
   * /command "token1 token2" -> [ "token1 token2" ]
   * /command token1 "token2 token3" -> [ "token1" "token2 token3" ]
   * ```
   * @unstable Parser implementation might vary until considered stable
   * */
  args: string[];
}
export type IMessageContext<T = {}> = IContext<T, Update.MessageUpdate> &
  CommandContextExtn;
export type ICallbackQueryContext<T = {}> = IContext<
  T,
  Update.CallbackQueryUpdate
>;
export type ICbQOrMsg = IMessageContext | ICallbackQueryContext;

export type ISceneContext = (IMessageContext | ICallbackQueryContext) & {
  scene: Scenes.SceneContextScene<
    Scenes.SceneContext<SceneSession>,
    SceneSession
  > & { state: any };
};

export type IStepContext = (IMessageContext | ICallbackQueryContext) & {
  scene: Scenes.SceneContextScene<
    WizardContext<WizardSession>,
    WizardSession
  > & { state: any };
  session: Scenes.WizardSession<WizardSession>;
  wizard: WizardContextWizard<WizardContext<WizardSession>>;
};
