import { LocalePhrase } from '@my-interfaces';
import { patternGroupName, patternGroupName0 } from '@my-common';
import { IMessageContext } from '@my-interfaces/vk';

const regExpByRegExp = /^\/(?<regex_body>.*?)\/(?<regex_flags>[gmiyusd]+)?$/;

// Custom template data
const templateData = { patternGroupName, patternGroupName0 };

export const checkLocaleCondition =
  (phrases: LocalePhrase[]) =>
  (value: string = undefined, ctx: IMessageContext) => {
    const passed = phrases
      .map((e) => [e, ctx.i18n.t(e, templateData)])
      .some(([key, phrase]) => {
        // By keyboard button
        if (ctx.state?.phrase === phrase) {
          return true;
        }

        if (key.split('.')[0] === 'regexp' && regExpByRegExp.test(phrase)) {
          const { regex_body, regex_flags } =
            phrase.match(regExpByRegExp).groups;
          const regExp = new RegExp(regex_body, regex_flags);

          if (regExp.test(value)) {
            ctx.$match = value.match(regExp);
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
