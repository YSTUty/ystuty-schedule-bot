import { resolve } from 'path';
import { I18n } from 'vk-io-i18n';

export const i18n: I18n = new I18n({
  defaultLanguage: 'ru',
  directory: resolve(__dirname, '../../../../locales/vk'),
  defaultLanguageOnMissing: true,
  useSession: true,
});
