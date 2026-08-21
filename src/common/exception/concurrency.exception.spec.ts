import {
  CooldownError,
  isConcurrencyControlError,
  LockBusyError,
} from './concurrency.exception';

describe('Concurrency exceptions', () => {
  test('detects concurrency control errors', () => {
    expect(isConcurrencyControlError(new LockBusyError())).toBe(true);
    expect(isConcurrencyControlError(new CooldownError())).toBe(true);
    expect(isConcurrencyControlError(new Error('other'))).toBe(false);
  });
});
