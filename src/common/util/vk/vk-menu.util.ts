import {
  patternGroupName,
  patternGroupName0,
  patternScheduleGroupTarget,
  patternTeacherId,
} from '@my-common/util/schedule.util';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';

const regExpByRegExp = /^\/(?<regex_body>.*?)\/(?<regex_flags>[gmiyusd]+)?$/;

// Custom template data
const templateData = {
  patternGroupName,
  patternGroupName0,
  patternScheduleGroupTarget,
  patternTeacherId,
};

export const checkLocaleCondition =
  (phrases: LocalePhrase[]) =>
  (value: string | undefined = undefined, ctx: IMessageContext) => {
    if (!value || !ctx.i18n) return false;

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
      ([key, phrase]) =>
        phrase !== null &&
        (ctx.messagePayload?.phrase === key ||
          (key.split('.')[0] !== 'regexp' && value === phrase)),
    );

    // Текст static keyboard и payload-кнопок должен выигрывать у широкой
    // regexp-команды, которая способна принять подпись за имя группы.
    if (literalButton) {
      if (!ctx.messagePayload?.phrase) {
        ctx.state.isLocalePhrase = true;
      }
      ctx.$match = /[\s\S]+/.exec(value)!;
      return true;
    }

    const passed = localizedPhrases.some(([key, phrase]) => {
      if (phrase === null) {
        return false;
      }

      if (key.split('.')[0] === 'regexp' && regExpByRegExp.test(phrase)) {
        const { regex_body, regex_flags } =
          phrase.match(regExpByRegExp)!.groups!;
        const regExp = new RegExp(regex_body, regex_flags);

        if (regExp.test(value)) {
          ctx.$match = /* pass = */ value.match(regExp)!;
          return true;
        }
      }

      const result = phrase === value;
      if (result) {
        ctx.state.isLocalePhrase = true;
      }
      return result;
    });

    return passed;
  };
