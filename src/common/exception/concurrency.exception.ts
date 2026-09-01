export class LockBusyError extends Error {
  constructor(
    message = 'Resource is busy',
    public readonly key?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = LockBusyError.name;
  }
}

export class CooldownError extends Error {
  constructor(
    message = 'Resource is cooling down',
    public readonly key?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = CooldownError.name;
  }
}

export const isLockBusyError = (error: unknown): error is LockBusyError =>
  error instanceof LockBusyError;

export const isCooldownError = (error: unknown): error is CooldownError =>
  error instanceof CooldownError;

export const isConcurrencyControlError = (
  error: unknown,
): error is LockBusyError | CooldownError =>
  isLockBusyError(error) || isCooldownError(error);
