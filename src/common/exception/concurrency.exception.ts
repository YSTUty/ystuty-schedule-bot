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

export const isConcurrencyControlError = (
  error: unknown,
): error is LockBusyError | CooldownError =>
  error instanceof LockBusyError || error instanceof CooldownError;
