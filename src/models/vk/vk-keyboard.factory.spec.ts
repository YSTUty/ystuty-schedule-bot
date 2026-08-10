import { VKKeyboardFactory } from './vk-keyboard.factory';

describe('VKKeyboardFactory', () => {
  const ctx = {
    i18n: { t: (phrase: string) => phrase },
  } as any;

  it('limits schedule notification group labels to 40 characters', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotificationGroups(
      ctx,
      1,
      ['Очень длинное название учебной группы для проверки лимита VK'],
      1,
    );

    expect(keyboard.inline().buttons[0][0].label).toHaveLength(40);
  });
});
