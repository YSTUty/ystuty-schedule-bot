import { Hears } from 'nestjs-vk';
import { LocalePhrase } from '@my-interfaces';
import { checkLocaleCondition } from '@my-common/util/vk';

export const VkHearsLocale = (phrases: LocalePhrase | LocalePhrase[]) => {
  const _phrases = Array.isArray(phrases) ? phrases : [phrases];
  return Hears(checkLocaleCondition(_phrases));
};
