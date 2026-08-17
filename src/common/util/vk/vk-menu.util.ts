import {
  patternGroupName,
  patternGroupName0,
  patternTeacherId,
} from '@my-common/util/ystuty.util';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';

const regExpByRegExp = /^\/(?<regex_body>.*?)\/(?<regex_flags>[gmiyusd]+)?$/;

// Custom template data
const templateData = { patternGroupName, patternGroupName0, patternTeacherId };

export const checkLocaleCondition =
  (phrases: LocalePhrase[]) =>
  (value: string | undefined = undefined, ctx: IMessageContext) => {
    if (!value || !ctx.i18n) return false;

    // let pass: RegExpExecArray = null;

    const wrapPhrase = (phrase: LocalePhrase) => {
      try {
        return ctx.i18n.t(phrase, templateData);
      } catch (err) {
        console.log('Fail compile phrase:', phrase, templateData);
        console.error(err);
        return null;
      }
    };

    const passed = phrases
      .map((e) => [e, wrapPhrase(e)] as const)
      .some(([key, phrase]) => {
        if (phrase === null) {
          return false;
        }

        // By keyboard button (значение `phrase` устанавливается в `payload` кнопки)
        if (ctx.messagePayload?.phrase === key) {
          ctx.$match = /* pass = */ value.match(phrase) as RegExpExecArray;
          return true;
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
