import { TelegramError } from 'telegraf-hardened';

import {
  isExpectedTelegramTransportError,
  isTelegramConversationUnavailableError,
  isTelegramUserUnavailableError,
} from './telegraf-exception.filter';

describe('isExpectedTelegramTransportError', () => {
  it.each([
    [403, 'Forbidden: bot was blocked by the user'],
    [403, 'Forbidden: user is deactivated'],
    [400, 'Bad Request: chat not found'],
    [429, 'Too Many Requests: retry after 1'],
  ])('recognizes expected Telegram API error %i', (code, description) => {
    expect(
      isExpectedTelegramTransportError(
        new TelegramError({ error_code: code, description }),
      ),
    ).toBe(true);
  });

  it('does not hide an unexpected Telegram API error', () => {
    expect(
      isExpectedTelegramTransportError(
        new TelegramError({
          error_code: 400,
          description: 'Bad Request: message text is empty',
        }),
      ),
    ).toBe(false);
  });

  it.each([
    [400, 'Bad Request: chat not found'],
    [403, 'Forbidden: bot was kicked from the group chat'],
    [403, 'Forbidden: bot was kicked from the supergroup chat'],
    [403, 'Forbidden: bot is not a member of the supergroup chat'],
  ])(
    'recognizes unavailable Telegram conversation %i: %s',
    (code, description) => {
      expect(
        isTelegramConversationUnavailableError(
          new TelegramError({ error_code: code, description }),
        ),
      ).toBe(true);
    },
  );

  it('does not mistake an unavailable group chat for an unavailable user', () => {
    expect(
      isTelegramUserUnavailableError(
        new TelegramError({
          error_code: 400,
          description: 'Bad Request: chat not found',
        }),
      ),
    ).toBe(false);
  });
});
