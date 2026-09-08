import { parseRegExpLiteral } from '@eslint-community/regexpp';
import type { AST } from '@eslint-community/regexpp';

/** Максимальный размер callback_data по Telegram Bot API в UTF-8 байтах. */
export const TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64;

/** Проверяет допустимый размер callback_data Telegram в UTF-8 байтах. */
export const isTelegramCallbackDataValid = (callbackData: string) => {
  const byteLength = Buffer.byteLength(callbackData, 'utf8');
  return byteLength >= 1 && byteLength <= TELEGRAM_CALLBACK_DATA_MAX_BYTES;
};

/** Бросает понятную ошибку до отправки или регистрации некорректного callback. */
export const assertTelegramCallbackData = (callbackData: string) => {
  const byteLength = Buffer.byteLength(callbackData, 'utf8');
  if (!isTelegramCallbackDataValid(callbackData)) {
    throw new RangeError(
      `Telegram callback_data must contain 1–${TELEGRAM_CALLBACK_DATA_MAX_BYTES} UTF-8 bytes; received ${byteLength}`,
    );
  }
};

/**
 * Возвращает нижнюю границу размера строки, которую регулярное выражение
 * обязано сопоставить. Assertions и backreference дают 0: это безопасная
 * недооценка, которая не создаёт ложных ошибок при регистрации handler-а.
 */
const getRegExpMinimumBytes = (node: AST.Node): number => {
  switch (node.type) {
    case 'Pattern':
    case 'CapturingGroup':
    case 'Group':
      return Math.min(...node.alternatives.map(getRegExpMinimumBytes));
    case 'Alternative':
    case 'StringAlternative':
      return getElementsMinimumBytes(node.elements);
    case 'Quantifier':
      return node.min * getRegExpMinimumBytes(node.element);
    case 'Character':
      return Buffer.byteLength(String.fromCodePoint(node.value), 'utf8');
    case 'CharacterClassRange':
      return getMinimumCodePointBytes(node.min.value, node.max.value);
    case 'CharacterClass':
      return node.negate
        ? 1
        : Math.min(...node.elements.map(getRegExpMinimumBytes));
    case 'ClassStringDisjunction':
      return Math.min(...node.alternatives.map(getRegExpMinimumBytes));
    // Dot, character-class escapes and Unicode properties can match at least
    // one byte. Class set expressions are intentionally underestimated too.
    case 'CharacterSet':
    case 'ExpressionCharacterClass':
    case 'ClassIntersection':
    case 'ClassSubtraction':
      return 1;
    // Assertions do not consume the match, and a backreference can reference
    // an optional/empty group. Zero is a safe lower bound in both cases.
    case 'Assertion':
    case 'Backreference':
    case 'Modifiers':
    case 'ModifierFlags':
    case 'Flags':
    case 'RegExpLiteral':
      return 0;
  }
};

/** Суммирует минимальный размер обязательных элементов альтернативы. */
const getElementsMinimumBytes = (elements: readonly AST.Node[]): number => {
  let total = 0;
  for (const element of elements) {
    total += getRegExpMinimumBytes(element);
  }
  return total;
};

/** Выбирает UTF-8 размер самого короткого code point из диапазона RegExp. */
const getMinimumCodePointBytes = (min: number, max: number): number => {
  const firstCodePointByByteLength = [0, 0x80, 0x800, 0x10000];
  const codePoint = firstCodePointByByteLength.find(
    (value) => value >= min && value <= max,
  );
  return Buffer.byteLength(String.fromCodePoint(codePoint ?? min), 'utf8');
};

/**
 * Проверяет, что RegExp-action в принципе может сопоставить callback_data
 * Telegram. Проверяется нижняя граница, а не размер `.source`: source не
 * является данными и может быть длиннее допустимого callback.
 */
export const assertTelegramCallbackDataRegExp = (trigger: RegExp) => {
  const minimumBytes = getRegExpMinimumBytes(
    parseRegExpLiteral(trigger).pattern,
  );
  if (minimumBytes > TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
    throw new RangeError(
      `Telegram callback_data RegExp ${trigger} requires at least ${minimumBytes} UTF-8 bytes; maximum is ${TELEGRAM_CALLBACK_DATA_MAX_BYTES}`,
    );
  }
};
