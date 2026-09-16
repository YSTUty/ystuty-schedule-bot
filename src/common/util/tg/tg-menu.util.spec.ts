import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { checkLocaleCondition } from './tg-menu.util';

describe('Telegram locale menu matcher', () => {
  it('matches a literal button label containing RegExp characters', () => {
    const buttonText = '📣 [A] Рассылки';
    const ctx = {
      i18n: {
        t: jest.fn().mockReturnValue(buttonText),
      },
      state: {},
    } as unknown as IContext;

    const match = checkLocaleCondition([LocalePhrase.Button_Broadcast])(
      buttonText,
      ctx,
    );

    expect(match?.[0]).toBe(buttonText);
  });

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
    } as unknown as IContext;

    const match = checkLocaleCondition([
      LocalePhrase.RegExp_Schedule_For_OneDay,
      LocalePhrase.Button_Schedule_Schedule,
    ])(buttonText, ctx);

    expect(match?.[0]).toBe(buttonText);
    expect(match?.groups?.groupTarget).toBeUndefined();
  });
});
