import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';

import { checkLocaleCondition } from './vk-menu.util';

describe('VK locale menu matcher', () => {
  it('prioritizes a literal schedule button over a broad schedule command', () => {
    const buttonText = 'Расписание группы';
    const ctx = {
      i18n: {
        t: jest.fn((phrase: LocalePhrase) =>
          phrase === LocalePhrase.Button_Schedule_Schedule
            ? buttonText
            : '/^расписание(?: (?<groupTarget>.+?))?$/i',
        ),
      },
      state: {},
    } as unknown as IMessageContext;

    const matches = checkLocaleCondition([
      LocalePhrase.RegExp_Schedule_For_OneDay,
      LocalePhrase.Button_Schedule_Schedule,
    ])(buttonText, ctx);

    expect(matches).toBe(true);
    expect(ctx.$match?.groups?.groupTarget).toBeUndefined();
  });
});
