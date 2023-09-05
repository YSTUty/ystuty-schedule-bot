import { resolve } from 'path';
import { I18n } from '@esindger/telegraf-i18n';

export const i18n: I18n = new I18n({
  defaultLanguage: 'ru',
  directory: resolve(__dirname, '../../../../locales/telegram'),
  defaultLanguageOnMissing: true,
  useSession: true,
});
