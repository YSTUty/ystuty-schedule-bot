import { TelegramButtons } from './telegram-buttons.util';

describe('TelegramButtons', () => {
  it('extends a native callback button with Bot API 9.6 appearance fields', () => {
    expect(
      TelegramButtons.callback('Отправить', 'feedback:submit', {
        style: 'success',
        icon_custom_emoji_id: '5368324170671202286',
      }),
    ).toEqual({
      text: 'Отправить',
      callback_data: 'feedback:submit',
      hide: false,
      style: 'success',
      icon_custom_emoji_id: '5368324170671202286',
    });
  });

  it('keeps the original hide option for reply keyboard buttons', () => {
    expect(
      TelegramButtons.text('Выбрать группу', {
        hide: true,
        style: 'primary',
      }),
    ).toEqual({
      text: 'Выбрать группу',
      hide: true,
      style: 'primary',
    });
  });

  it('supports the same URL button shape as Markup.button', () => {
    expect(
      TelegramButtons.url('Открыть', 'https://ystuty.ru/', {
        style: 'primary',
      }),
    ).toMatchObject({
      text: 'Открыть',
      url: 'https://ystuty.ru/',
      style: 'primary',
    });
  });
});
