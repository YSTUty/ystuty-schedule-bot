import type * as tg from 'telegraf-hardened/types';
import type { I18nContext } from '@esindger/telegraf-i18n';
import type { Context, Scenes } from 'telegraf-hardened';
import type { Telegram } from 'telegraf-hardened';
import type {
  SceneSessionData,
  SceneSession as TgSceneSession,
  WizardContext,
  WizardContextWizard,
  WizardSessionData,
} from 'telegraf-hardened/scenes';

import type { LocalePhrase, TelegramLocalePhrase } from '@my-interfaces';

import type { Conversation } from '../../models/social/entity/conversation.entity';
import type { UserSocial } from '../../models/user/entity/user-social.entity';
import type { User } from '../../models/user/entity/user.entity';

export type NextFn = (...args: any[]) => Promise<any>;
export type AnyObj = Record<string, unknown>;
export type Tail<T> = T extends [unknown, ...infer U] ? U : never;
type Shorthand<FName extends keyof Telegram> = Telegram[FName] extends (
  ...args: infer Args
) => unknown
  ? Tail<Args>
  : never;

export interface ISessionState extends Partial<TgSceneSession> {
  __language_code?: string;

  teacherId?: number;
  /** Временный выбор доставок для удаления сообщений рассылки. */
  broadcastDeleteSelections?: Record<string, number[]>;
}

type ISessionConversationState = Partial<TgSceneSession>;

type SceneSession = {
  state: any;
} & SceneSessionData;

type WizardSession = {
  state: any;
} & WizardSessionData;

type ContextState = {
  appeal: boolean;
  isLocalePhrase?: boolean;
  // TODO: move `user`, `userSocial` to here
  // user?: User | null;
};

type CombinedContext = {
  session: ISessionState;
  sessionConversation: ISessionConversationState;

  match?: RegExpExecArray;

  noUpdateUserSocial?: boolean;
  userSocial: UserSocial;
  user?: User | null;
  conversation?: Conversation;

  state: ContextState;

  scene: OmitT<
    Scenes.SceneContextScene<Scenes.SceneContext<SceneSession>, SceneSession>,
    'state'
  > & { state: AnyObj };

  i18n: I18nContext<
    Record<LocalePhrase | TelegramLocalePhrase, AnyObj | never>
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
      parse_mode?: tg.ParseMode;
      /** Unique identifier for the target message thread */
      message_thread_id?: number;
      /** A JSON-serialized list of special entities that appear in message text, which can be specified instead of parse_mode */
      entities?: any[];
    },
  ): Promise<boolean>;

  sendStreamingMessage(
    text: string,
    extra?: {
      parse_mode?: tg.ParseMode;
      chunkDelay?: number;
      gap?: number;
      htmlAwareSplit?: boolean;
      replyToMessageId?: number;
    },
  ): Promise<any>;
};

export type IContext<
  T = {},
  U extends tg.Update = tg.Update,
> = CombinedContext & OmitT<Context<U>, 'state'> & T;

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
export type IMessageContext<T = {}> = IContext<T, tg.Update.MessageUpdate> &
  CommandContextExtn;
export type ICallbackQueryContext<T = {}> = IContext<
  T,
  tg.Update.CallbackQueryUpdate
>;
export type ICbQOrMsg = IMessageContext | ICallbackQueryContext;

export type ISceneContext<SceneState = AnyObj> = OmitT<ICbQOrMsg, 'scene'> & {
  scene: OmitT<
    Scenes.SceneContextScene<Scenes.SceneContext<SceneSession>, SceneSession>,
    'state'
  > & { state: SceneState };
};

export type IStepContext<SceneState = AnyObj> = OmitT<ICbQOrMsg, 'scene'> & {
  scene: OmitT<
    Scenes.SceneContextScene<WizardContext<WizardSession>, WizardSession>,
    'state'
  > & { state: SceneState };
  session: Scenes.WizardSession<WizardSession>;
  wizard: WizardContextWizard<WizardContext<WizardSession>>;
};
