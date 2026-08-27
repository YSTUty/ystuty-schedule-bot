import { VKKeyboardFactory } from './vk-keyboard.factory';

describe('VKKeyboardFactory', () => {
  const ctx = {
    i18n: { t: (phrase: string) => phrase },
  } as any;

  it('limits schedule notif group labels to 40 characters', () => {
    const keyboard = new VKKeyboardFactory().getPagination({
      currentPage: 1,
      totalPages: 1,
      items: ['Очень длинное название учебной группы для проверки лимита VK'],
      getPagePayload: () => ({}),
    });

    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons[0][0].action.label).toHaveLength(40);
  });

  it('creates a schedule notif editor within VK inline keyboard limits', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifEditor(ctx, {
      id: 1,
      deliveryHour: 8,
      deliveryMinute: 30,
      targetDayOffset: 0,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
    });

    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const buttonsCount = renderedKeyboard.buttons.flat().length;

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(buttonsCount).toBeLessThanOrEqual(10);
  });

  it('creates the editor weekday page within VK inline keyboard limits', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifEditorWeekdays(
      ctx,
      {
        id: 1,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      },
    );
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons.flat()).toHaveLength(8);
  });

  it('opens hour selection before choosing minutes in the notif editor', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifEditor(ctx, {
      id: 7,
      deliveryHour: 8,
      deliveryMinute: 30,
      targetDayOffset: 0,
      weekdays: [1],
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(
      JSON.parse(renderedKeyboard.buttons[0][0].action.payload)
        .scheduleNotifAction,
    ).toBe('editTime');
  });

  it('asks for deletion confirmation instead of deleting immediately', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifSettings(ctx, {
      id: 7,
      isEnabled: true,
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const deleteButton = renderedKeyboard.buttons
      .flat()
      .find(
        (button: any) =>
          button.action.label === 'button.schedule_notification.delete',
      );

    expect(JSON.parse(deleteButton.action.payload).scheduleNotifAction).toBe(
      'deleteConfirm',
    );
  });

  it('uses a compact three-button pager for notif hours', () => {
    const keyboard = new VKKeyboardFactory().getScheduleNotifHours(ctx);
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons).toHaveLength(4);
    expect(renderedKeyboard.buttons[2]).toHaveLength(3);
    expect(renderedKeyboard.buttons[2][1].action.label).toBe('-1-');
  });

  it('opens the audience filters editor from broadcast settings', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastSettings(ctx, {
      onlyAuthorized: true,
      groupName: 'ЦИС-21',
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));
    const actions = renderedKeyboard.buttons
      .flat()
      .map((button: any) => JSON.parse(button.action.payload).broadcastAction);

    expect(actions).toEqual(expect.arrayContaining(['filters']));
  });

  it('combines recipient action and feedback within VK inline keyboard limits', () => {
    const keyboard = new VKKeyboardFactory().getBroadcastRecipientKeyboard({
      deliveryId: 15,
      actionKeyboard: { type: 'select_group' },
      feedbackButton: { text: '🫡' },
    });
    const renderedKeyboard = JSON.parse(String(keyboard.inline()));

    expect(renderedKeyboard.buttons).toHaveLength(2);
    expect(renderedKeyboard.buttons.flat()).toHaveLength(2);
    expect(
      JSON.parse(renderedKeyboard.buttons[0][0].action.payload),
    ).toMatchObject({
      broadcastRecipientAction: 'select_group',
      deliveryId: 15,
    });
  });
});
