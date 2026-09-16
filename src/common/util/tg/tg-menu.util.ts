import { Context } from 'telegraf-hardened';

import {
  patternGroupName,
  patternGroupName0,
  patternScheduleGroupTarget,
  patternTeacherId,
} from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

const regExpByRegExp = /^\/(?<regex_body>.*?)\/(?<regex_flags>[gmiyusd]+)?$/;

// Custom template data
const templateData = {
  patternGroupName,
  patternGroupName0,
  patternScheduleGroupTarget,
  patternTeacherId,
};

export const checkLocaleCondition =
  (
    phrases: LocalePhrase[],
  ): ((value: string, ctx: Context) => RegExpExecArray | null) =>
  (value: string, ctx: IContext): RegExpExecArray | null => {
    if (!value || !ctx.i18n) return null;

    let pass: RegExpExecArray | null = null;

    const wrapPhrase = (phrase: LocalePhrase) => {
      try {
        return ctx.i18n.t(phrase, templateData);
      } catch (err) {
        console.log('Fail compile phrase:', phrase, templateData);
        console.error(err);
        return null;
      }
    };

    const localizedPhrases = phrases.map(
      (phrase) => [phrase, wrapPhrase(phrase)] as const,
    );
    const literalButton = localizedPhrases.find(
      ([key, phrase]) => key.split('.')[0] !== 'regexp' && value === phrase,
    );

    // Сначала проверяем точные подписи кнопок: широкая regexp-команда может
    // иначе принять «Расписание группы» за запрос группы «группы».
    if (literalButton) {
      return /[\s\S]+/.exec(value);
    }

    localizedPhrases.some(([key, phrase]) => {
      if (phrase === null) {
        return false;
      }

      if (key.split('.')[0] === 'regexp' && regExpByRegExp.test(phrase)) {
        const { regex_body, regex_flags } =
          phrase.match(regExpByRegExp)!.groups!;
        const regExp = new RegExp(regex_body, regex_flags);

        if (regExp.test(value)) {
          pass = regExp.exec(value);
          return true;
        }
      }

      const result = phrase === value;
      if (result) {
        ctx.state.isLocalePhrase = true;
      }
      return result;
    });

    return pass;
  };
