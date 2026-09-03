import { Hears } from 'nestjs-telega';

import { checkLocaleCondition } from '@my-common/util/tg';
import { LocalePhrase } from '@my-interfaces';

export const TgHearsLocale = (phrases: LocalePhrase | LocalePhrase[]) => {
  const _phrases = Array.isArray(phrases) ? phrases : [phrases];
  return Hears(checkLocaleCondition(_phrases));
};
