import { Markup as NativeMarkup } from 'telegraf-hardened';
import type {
  InlineKeyboardButton,
  KeyboardButtonRequestChat,
  KeyboardButtonRequestUsers,
} from 'telegraf-hardened/types';

import { assertTelegramCallbackData } from '@my-common';

/** Дополнительное оформление кнопки, доступное в Telegram Bot API 9.6. */
export type TelegramButtonOptions = {
  /** Скрывает кнопку при сборке keyboard — совместимо с `Markup.button`. */
  hide?: boolean;
  /** Семантический цвет для основного, успешного или опасного действия. */
  style?: InlineKeyboardButton['style'];
  /** ID custom emoji перед текстом кнопки при выполнении условий Telegram. */
  icon_custom_emoji_id?: string;
};

type StyledButton = {
  icon_custom_emoji_id?: string;
  style?: InlineKeyboardButton['style'];
};

export { assertTelegramCallbackData } from '@my-common';

/**
 * Обёртка над Markup для inline callback-кнопок.
 *
 * Все Telegram-модули используют её вместо native `Markup`, чтобы callback не
 * мог обойти централизованную проверку лимита Telegram Bot API.
 */
export const TelegramMarkup = {
  inlineKeyboard: NativeMarkup.inlineKeyboard,
  keyboard: NativeMarkup.keyboard,
  removeKeyboard: NativeMarkup.removeKeyboard,
  button: {
    ...NativeMarkup.button,
    callback: (text: string, callbackData: string, hide?: boolean) => {
      assertTelegramCallbackData(callbackData);
      return NativeMarkup.button.callback(text, callbackData, hide);
    },
  },
};

/**
 * Расширяет native `Markup.button` полями Bot API 9.6.
 *
 * В `telegraf-hardened` эти поля уже есть в public type definitions, но
 * фабричные методы `Markup.button.*` пока не принимают их параметром.
 */
const withOptions = <T extends StyledButton>(
  button: T,
  options?: TelegramButtonOptions,
): T => ({
  ...button,
  ...(options?.style && { style: options.style }),
  ...(options?.icon_custom_emoji_id && {
    icon_custom_emoji_id: options.icon_custom_emoji_id,
  }),
});

/**
 * Типизированное дополнение к `Markup.button`.
 *
 * Методы сохраняют семантику и параметры `Markup.button`; последний параметр
 * `options` добавляет style, custom emoji и исходный флаг `hide`.
 */
export const TelegramButtons = {
  text: (text: string, options?: TelegramButtonOptions) =>
    withOptions(NativeMarkup.button.text(text, options?.hide), options),

  contactRequest: (text: string, options?: TelegramButtonOptions) =>
    withOptions(
      NativeMarkup.button.contactRequest(text, options?.hide),
      options,
    ),

  locationRequest: (text: string, options?: TelegramButtonOptions) =>
    withOptions(
      NativeMarkup.button.locationRequest(text, options?.hide),
      options,
    ),

  pollRequest: (
    text: string,
    type?: 'quiz' | 'regular',
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.pollRequest(text, type, options?.hide),
      options,
    ),

  userRequest: (
    text: string,
    requestId: number,
    extra?: Omit<KeyboardButtonRequestUsers, 'request_id' | 'text'>,
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.userRequest(text, requestId, extra, options?.hide),
      options,
    ),

  botRequest: (
    text: string,
    requestId: number,
    extra?: Omit<
      KeyboardButtonRequestUsers,
      'request_id' | 'user_is_bot' | 'text'
    >,
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.botRequest(text, requestId, extra, options?.hide),
      options,
    ),

  groupRequest: (
    text: string,
    requestId: number,
    extra?: KeyboardButtonRequestChat,
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.groupRequest(text, requestId, extra, options?.hide),
      options,
    ),

  channelRequest: (
    text: string,
    requestId: number,
    extra?: Omit<
      KeyboardButtonRequestChat,
      'request_id' | 'chat_is_channel' | 'chat_is_forum'
    >,
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.channelRequest(text, requestId, extra, options?.hide),
      options,
    ),

  url: (text: string, url: string, options?: TelegramButtonOptions) =>
    withOptions(NativeMarkup.button.url(text, url, options?.hide), options),

  callback: (
    text: string,
    callbackData: string,
    options?: TelegramButtonOptions,
  ) => {
    return withOptions(
      TelegramMarkup.button.callback(text, callbackData, options?.hide),
      options,
    );
  },

  switchToChat: (
    text: string,
    value: string,
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.switchToChat(text, value, options?.hide),
      options,
    ),

  switchToCurrentChat: (
    text: string,
    value: string,
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.switchToCurrentChat(text, value, options?.hide),
      options,
    ),

  game: (text: string, options?: TelegramButtonOptions) =>
    withOptions(NativeMarkup.button.game(text, options?.hide), options),

  pay: (text: string, options?: TelegramButtonOptions) =>
    withOptions(NativeMarkup.button.pay(text, options?.hide), options),

  login: (
    text: string,
    url: string,
    loginOptions?: {
      forward_text?: string;
      bot_username?: string;
      request_write_access?: boolean;
    },
    options?: TelegramButtonOptions,
  ) =>
    withOptions(
      NativeMarkup.button.login(text, url, loginOptions, options?.hide),
      options,
    ),

  webApp: (text: string, url: string, options?: TelegramButtonOptions) =>
    withOptions(NativeMarkup.button.webApp(text, url, options?.hide), options),
} as const;
