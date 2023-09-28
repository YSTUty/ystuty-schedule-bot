import { Context, Scenes } from 'telegraf';
import type {
  SceneSessionData,
  WizardContext,
  WizardContextWizard,
  WizardSessionData,
} from 'telegraf/typings/scenes';
import type { Update } from 'telegraf/types';
import { Deunionize } from 'telegraf/typings/deunionize';
import { I18nContext } from '@esindger/telegraf-i18n';
import { LocalePhrase, TelegramLocalePhrase } from '@my-interfaces';

import { UserSocial } from '../../models/user/entity/user-social.entity';
import { User } from '../../models/user/entity/user.entity';

interface ISessionState {
  __language_code?: string;
  __scenes?: { current?: string; state?: any; cursor?: number };
}

interface ISessionConversationState {
  // // TODO: remove it. Use `conversation.groupName`
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
  [key: string]: any;
};

type CombinedContext = {
  session: ISessionState;
  sessionConversation: ISessionConversationState;

  match?: RegExpExecArray;

  userSocial: UserSocial;
  user?: User;

  state: ContextState;

  scene: Scenes.SceneContextScene<
    Scenes.SceneContext<SceneSession>,
    SceneSession
  > & { state: any };

  i18n: I18nContext<
    Record<LocalePhrase | TelegramLocalePhrase, Record<string, unknown> | never>
  >;
  tryAnswerCbQuery: Context['answerCbQuery'];
};

export type IContext<
  T = {},
  U extends Deunionize<Update> = Update,
> = CombinedContext & Context<U> & T;

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
