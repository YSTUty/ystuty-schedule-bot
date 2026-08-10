import { VKKeyboardFactory } from './vk-keyboard.factory';

describe('VKKeyboardFactory', () => {
  const ctx = {
    i18n: { t: (phrase: string) => phrase },
  } as any;

  it('limits schedule notification group labels to 40 characters', () => {
    const keyboard = new VKKeyboardFactory().getPagination({
      currentPage: 1,
      totalPages: 1,
      items: ['Очень длинное название учебной группы для проверки лимита VK'],
      getPagePayload: () => ({}),
    });

    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons[0][0].action.label).toHaveLength(40);
  });

  it('creates a schedule notification editor within VK inline keyboard limits', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotificationEditor(
      ctx,
      {
        id: 1,
        deliveryHour: 8,
        deliveryMinute: 30,
        targetDayOffset: 0,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      },
    );

    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const buttonsCount = renderedKeyboard.buttons.flat().length;

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(buttonsCount).toBeLessThanOrEqual(10);
  });

  it('creates the editor weekday page within VK inline keyboard limits', () => {
    const keyboard =
      new VKKeyboardFactory().getScheduleNotificationEditorWeekdays(ctx, {
        id: 1,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons.flat()).toHaveLength(8);
  });

  it('opens hour selection before choosing minutes in the notification editor', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotificationEditor(
      ctx,
      {
        id: 7,
        deliveryHour: 8,
        deliveryMinute: 30,
        targetDayOffset: 0,
        weekdays: [1],
      },
    );
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(
      JSON.parse(renderedKeyboard.buttons[0][0].action.payload)
        .scheduleNotificationAction,
    ).toBe('editTime');
  });

  it('asks for deletion confirmation instead of deleting immediately', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotificationSettings(
      ctx,
      { id: 7, isEnabled: true },
    );
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const deleteButton = renderedKeyboard.buttons
      .flat()
      .find(
        (button: any) =>
          button.action.label === 'button.schedule_notification.delete',
      );

    expect(
      JSON.parse(deleteButton.action.payload).scheduleNotificationAction,
    ).toBe('deleteConfirm');
  });
});
