import {
  CooldownError,
  isConcurrencyControlError,
  isCooldownError,
  isLockBusyError,
  LockBusyError,
} from './concurrency.exception';

describe('Concurrency exceptions', () => {
  test('detects concurrency control errors', () => {
    expect(isConcurrencyControlError(new LockBusyError())).toBe(true);
    expect(isConcurrencyControlError(new CooldownError())).toBe(true);
    expect(isConcurrencyControlError(new Error('other'))).toBe(false);
  });

  test('distinguishes an occupied lock from a saturated queue', () => {
    expect(isLockBusyError(new LockBusyError())).toBe(true);
    expect(isLockBusyError(new CooldownError())).toBe(false);
    expect(isCooldownError(new CooldownError())).toBe(true);
    expect(isCooldownError(new LockBusyError())).toBe(false);
  });
});
