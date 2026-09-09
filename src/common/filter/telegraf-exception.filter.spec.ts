import { TelegramError } from 'telegraf-hardened';

import { isExpectedTelegramTransportError } from './telegraf-exception.filter';

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
});
