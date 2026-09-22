import { LocalePhrase } from '@my-interfaces';

import { VKKeyboardFactory } from '../../vk-keyboard.factory';

import { VkScheduleKeyboardFactory } from './vk-schedule-keyboard.factory';

describe('VkScheduleKeyboardFactory', () => {
  const ctx = {
    i18n: { t: jest.fn((phrase: string) => phrase) },
  } as any;

  it('builds all schedule controls as VK callbacks', () => {
    const keyboard = new VkScheduleKeyboardFactory(
      new VKKeyboardFactory(),
    ).getSchedule(ctx, { type: 'group', id: 'ЦИС-46' });
    const buttons = JSON.parse(String(keyboard.inline())).buttons.flat();

    expect(buttons.map((button: any) => button.action.type)).toEqual([
      'callback',
      'callback',
      'callback',
      'callback',
    ]);
    expect(
      buttons.map((button: any) => JSON.parse(button.action.payload)),
    ).toEqual(
      expect.arrayContaining([
        {
          phrase: LocalePhrase.Button_Schedule_ForToday,
          groupName: 'ЦИС-46',
        },
      ]),
    );
  });
});
