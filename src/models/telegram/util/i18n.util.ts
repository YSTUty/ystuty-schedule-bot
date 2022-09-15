import { resolve } from 'path';
import { I18n } from '@esindger/telegraf-i18n';
import { patternGroupName, patternGroupName0 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

export const i18n: I18n = new I18n({
    defaultLanguage: 'ru',
    directory: resolve(__dirname, '../../../../locales/telegram'),
    defaultLanguageOnMissing: true,
    useSession: true,
});

const regExpByRegExp = /^\/(?<regex_body>.*?)\/(?<regex_flags>[gmiyusd]+)?$/;

// Custom template data
const templateData = { patternGroupName, patternGroupName0 };

export const checkLocaleCondition =
    (phrases: LocalePhrase[]) => (value: string, ctx: IContext) => {
        if (!value || !ctx.i18n) return null;

        let pass: RegExpExecArray = null;

        phrases
            .map((e) => [e, ctx.i18n.t(e, templateData)] as const)
            .some(([key, phrase]) => {
                // By keyboard button
                if (value === phrase) {
                    pass = value.match(phrase) as RegExpExecArray;
                    return true;
                }

                if (
                    key.split('.')[0] === 'regexp' &&
                    regExpByRegExp.test(phrase)
                ) {
                    const { regex_body, regex_flags } =
                        phrase.match(regExpByRegExp).groups;
                    const regExp = new RegExp(regex_body, regex_flags);

                    if (regExp.test(value)) {
                        pass = regExp.exec(value);
                        return true;
                    }
                }

                return phrase === value;
            });

        return pass;
    };
