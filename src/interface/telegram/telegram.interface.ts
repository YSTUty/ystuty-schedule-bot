import { Context, Scenes } from 'telegraf';
import {
    SceneSessionData,
    WizardContext,
    WizardContextWizard,
    WizardSessionData,
} from 'telegraf/typings/scenes';
import * as tg from 'telegraf/typings/core/types/typegram';
import { I18nContext } from '@esindger/telegraf-i18n';
import { LocalePhrase } from '@my-interfaces';

interface ISessionState {
    selectedGroupName?: string;
    isBlockedBot?: boolean;
}

type SceneSession = {
    state: any;
} & SceneSessionData;

type WizardSession = {
    state: any;
} & WizardSessionData;

export type CombinedContext = {
    session: ISessionState;
    sessionConversation: ISessionState;

    match?: RegExpExecArray;

    scene: Scenes.SceneContextScene<
        Scenes.SceneContext<SceneSession>,
        SceneSession
    > & { state: any };

    i18n: I18nContext<Record<LocalePhrase, Record<string, unknown> | never>>;
    tryAnswerCbQuery: Context['answerCbQuery'];
};

export type IContext<T = {}> = CombinedContext & Context & T;
export type IMessageContext<T = {}> = CombinedContext &
    Context<tg.Update.MessageUpdate> &
    T;

export type ISceneContext = IMessageContext & {
    scene: Scenes.SceneContextScene<
        Scenes.SceneContext<SceneSession>,
        SceneSession
    > & { state: any };
};

export type IStepContext = IMessageContext & {
    scene: Scenes.SceneContextScene<
        WizardContext<WizardSession>,
        WizardSession
    > & { state: any };
    session: Scenes.WizardSession<WizardSession>;
    wizard: WizardContextWizard<WizardContext<WizardSession>>;
};
