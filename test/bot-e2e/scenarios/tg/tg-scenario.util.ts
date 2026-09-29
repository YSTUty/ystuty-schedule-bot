import type {
  FakeTelegramApiCall,
  FakeTelegramApiParams,
  FakeTelegramMessage,
} from '../../fake-api/telegram-api.fake';

export type TgSendMessageCall = FakeTelegramApiCall<
  'sendMessage',
  FakeTelegramApiParams,
  FakeTelegramMessage
>;
export type TgEditMessageCall = FakeTelegramApiCall<
  'editMessageText',
  FakeTelegramApiParams,
  FakeTelegramMessage
>;

type TgInlineButton = Record<string, unknown> & {
  callback_data?: string;
  text?: string;
};
type TgReplyMarkup = Record<string, unknown> & {
  keyboard?: unknown[][];
  inline_keyboard?: TgInlineButton[][];
};
type TgReplyKeyboardButton = { text: string };

export const hasTgReplyKeyboard = (value: unknown) =>
  !!getTgReplyMarkup(value)?.keyboard;

export const hasTgInlineKeyboard = (value: unknown) =>
  !!getTgReplyMarkup(value)?.inline_keyboard;

export const hasTgCallback = (value: unknown, data: string) =>
  getTgButtons(value).some((button) => button.callback_data === data);

export const getTgCallbackData = <TData extends string>(
  call: FakeTelegramApiCall,
  predicate: (data: string, button: TgInlineButton) => data is TData,
): TData => {
  const button = getTgButtons(call.params.reply_markup).find(
    (item) =>
      typeof item.callback_data === 'string' &&
      predicate(item.callback_data, item),
  );
  if (!button?.callback_data || typeof button.callback_data !== 'string') {
    throw new Error(`No expected Telegram callback button in ${call.method}`);
  }
  return button.callback_data as TData;
};

export const getTgReplyKeyboardText = (value: unknown, fallback: string) => {
  const keyboard = getTgReplyMarkup(value)?.keyboard;
  if (!Array.isArray(keyboard)) return fallback;

  const button = keyboard
    .flat()
    .find((item) =>
      typeof item === 'string'
        ? item === fallback
        : isTgReplyKeyboardButton(item) && item.text === fallback,
    );
  return typeof button === 'string'
    ? button
    : isTgReplyKeyboardButton(button)
      ? button.text
      : fallback;
};

const getTgReplyMarkup = (value: unknown): TgReplyMarkup | undefined =>
  value && typeof value === 'object' && 'reply_markup' in value
    ? (value.reply_markup as TgReplyMarkup)
    : undefined;

const isTgReplyKeyboardButton = (
  value: unknown,
): value is TgReplyKeyboardButton =>
  !!value &&
  typeof value === 'object' &&
  'text' in value &&
  typeof value.text === 'string';

const getTgButtons = (value: unknown): TgInlineButton[] => {
  const keyboard =
    value &&
    typeof value === 'object' &&
    'inline_keyboard' in value &&
    Array.isArray(value.inline_keyboard)
      ? value.inline_keyboard
      : getTgReplyMarkup(value)?.inline_keyboard;
  return Array.isArray(keyboard)
    ? keyboard.flatMap((row) => (Array.isArray(row) ? row : []))
    : [];
};
