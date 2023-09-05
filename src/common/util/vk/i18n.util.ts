import { resolve } from 'path';
import { I18n, pluralize } from 'vk-io-i18n';
import * as xEnv from '@my-environment';

export const i18n: I18n = new I18n({
  defaultLanguage: 'ru',
  directory: resolve(__dirname, '../../../../locales/vk'),
  defaultLanguageOnMissing: true,
  useSession: true,
  templateData: { pluralize, webViewLink: xEnv.YSTUTY_WEB_VIEW_ADDRESS },
});
