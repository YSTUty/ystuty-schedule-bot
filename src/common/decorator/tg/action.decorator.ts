import { Action as TelegaAction } from 'nestjs-telega';

import {
  assertTelegramCallbackData,
  assertTelegramCallbackDataRegExp,
} from '@my-common/util/telegram-callback-data.util';

type TelegramActionTrigger =
  | string
  | RegExp
  | ((value: string, ctx: unknown) => RegExpExecArray | null);

type TelegramActionTriggers = TelegramActionTrigger | TelegramActionTrigger[];

/**
 * Регистрирует Telegram action с проверкой лимита callback_data.
 *
 * Строковые action и минимальный размер RegExp проверяются при загрузке
 * модуля. Predicate статически не анализируется и передаётся библиотеке как
 * есть; данные callback-кнопок проверяются при их создании.
 */
export const Action = (triggers: TelegramActionTriggers): MethodDecorator => {
  const normalize = (trigger: TelegramActionTrigger): TelegramActionTrigger => {
    if (typeof trigger === 'string') {
      assertTelegramCallbackData(trigger);
    } else if (trigger instanceof RegExp) {
      assertTelegramCallbackDataRegExp(trigger);
    }

    return trigger;
  };

  const normalized = Array.isArray(triggers)
    ? triggers.map(normalize)
    : normalize(triggers);
  return TelegaAction(normalized as Parameters<typeof TelegaAction>[0]);
};
