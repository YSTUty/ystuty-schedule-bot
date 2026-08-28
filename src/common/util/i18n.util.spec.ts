import { LocalePhrase } from '@my-interfaces';

import { i18n as telegramI18n } from './tg/i18n.util';
import { i18n as vkI18n } from './vk/i18n.util';

describe('schedule web-view link', () => {
  const groupName = 'ЦИС 11/А?#';
  const encodedGroupName = 'ЦИС%2011/А%3F%23';
  const webViewLink = 'schedule.example';

  it('encodes URI-special characters in the Telegram group name', () => {
    const content = telegramI18n
      .createContext('ru', {
        ctx: { userSocial: { groupName } },
        webViewLink,
      })
      .t(LocalePhrase.Page_Start);

    expect(content).toContain(`/g/${encodedGroupName}`);
  });

  it('encodes URI-special characters in the VK group name', () => {
    const content = vkI18n
      .createContext('ru', {
        ctx: { state: { userSocial: { groupName } }, isDM: true },
        webViewLink,
      })
      .t(LocalePhrase.Page_Start);

    expect(content).toContain(`/g/${encodedGroupName}`);
  });
});
