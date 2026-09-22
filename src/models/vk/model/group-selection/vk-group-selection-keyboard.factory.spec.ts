import { LocalePhrase } from '@my-interfaces';

import { VkGroupSelectionKeyboardFactory } from './vk-group-selection-keyboard.factory';

describe('VkGroupSelectionKeyboardFactory', () => {
  it('creates an inline callback for opening group selection', () => {
    const keyboard = new VkGroupSelectionKeyboardFactory().getSelectGroup(
      { i18n: { t: jest.fn((phrase: string) => phrase) } } as any,
      'ЦИС-46',
    );
    const button = JSON.parse(String(keyboard.inline())).buttons[0][0];

    expect(button.action).toMatchObject({
      type: 'callback',
      payload: JSON.stringify({
        phrase: LocalePhrase.Button_SelectGroup,
        groupName: 'ЦИС-46',
      }),
    });
  });
});
