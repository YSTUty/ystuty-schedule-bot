import { CooldownError, LockBusyError } from '@my-common/exception';

import { ConcurrencyService } from './concurrency.service';

jest.mock('redlock-universal', () => {
  class MockLockAcquisitionError extends Error {}
  const acquire = jest.fn();
  const release = jest.fn();

  return {
    __esModule: true,
    IoredisAdapter: {
      from: jest.fn(() => ({ type: 'adapter' })),
    },
    createLock: jest.fn(() => ({ acquire, release })),
    createRedlock: jest.fn(() => ({ acquire, release })),
    LockAcquisitionError: MockLockAcquisitionError,
    __mock: { acquire, release },
  };
});

describe('ConcurrencyService', () => {
  const createService = () => new ConcurrencyService({ redis: {} } as any);

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('buildKey normalizes optional key parts', () => {
    const service = createService();

    expect(
      service.buildKey('schedule:request', 'teacher name', null, undefined, 42),
    ).toBe('schedule_request:teacher_name:42');

    service.onApplicationShutdown();
  });

  test('exclusiveLocal serializes handlers by key', async () => {
    const service = createService();
    const order: string[] = [];
    let releaseFirst!: () => void;

    const first = service.exclusiveLocal('same-key', async () => {
      order.push('first:start');
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      order.push('first:end');
    });
    const second = service.exclusiveLocal('same-key', async () => {
      order.push('second:start');
    });

    await Promise.resolve();
    expect(order).toEqual(['first:start']);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
  });

  test('tryExclusiveLocal throws LockBusyError when key is busy', async () => {
    const service = createService();
    let releaseFirst!: () => void;
    const first = service.exclusiveLocal('busy-key', async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });

    await Promise.resolve();
    await expect(
      service.tryExclusiveLocal('busy-key', async () => 'never'),
    ).rejects.toBeInstanceOf(LockBusyError);

    releaseFirst();
    await first;
  });

  test('queueLocal preserves FIFO order for the same key', async () => {
    const service = createService();
    const order: string[] = [];

    await Promise.all([
      service.queueLocal('queue-key', async () => {
        order.push('first');
      }),
      service.queueLocal('queue-key', async () => {
        order.push('second');
      }),
      service.queueLocal('queue-key', async () => {
        order.push('third');
      }),
    ]);

    expect(order).toEqual(['first', 'second', 'third']);
    service.onApplicationShutdown();
  });

  test('queueLocal creates one queue for simultaneous first updates', async () => {
    const service = createService();
    let running = 0;
    let maxRunning = 0;

    await Promise.all(
      Array.from({ length: 4 }, () =>
        service.queueLocal('new-queue-key', async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await new Promise<void>((resolve) => setImmediate(resolve));
          running--;
        }),
      ),
    );

    expect(maxRunning).toBe(1);
    service.onApplicationShutdown();
  });

  test('queueLocal rejects only after the waiting queue is saturated', async () => {
    const service = createService();
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const first = service.queueLocal('queue-limit', async () => {
      firstStarted();
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });
    await started;

    const second = service.queueLocal('queue-limit', async () => undefined, {
      maxQueueSize: 3,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const third = service.queueLocal('queue-limit', async () => undefined, {
      maxQueueSize: 3,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const fourth = service.queueLocal('queue-limit', async () => undefined, {
      maxQueueSize: 3,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    await expect(
      service.queueLocal('queue-limit', async () => undefined, {
        maxQueueSize: 3,
      }),
    ).rejects.toBeInstanceOf(CooldownError);

    releaseFirst();
    await Promise.all([first, second, third, fourth]);
    service.onApplicationShutdown();
  });

  test('onApplicationShutdown disposes registries safely', () => {
    const service = createService();
    expect(() => service.onApplicationShutdown()).not.toThrow();
  });

  test('exclusiveDistributed acquires and releases a distributed lock', async () => {
    const { __mock } = jest.requireMock('redlock-universal');
    __mock.acquire.mockResolvedValueOnce({ id: 'h1' });
    __mock.release.mockResolvedValueOnce(true);

    const service = createService();
    const result = await service.exclusiveDistributed(
      'dist-key',
      async () => 'ok',
    );

    expect(result).toBe('ok');
    expect(__mock.acquire).toHaveBeenCalledTimes(1);
    expect(__mock.release).toHaveBeenCalledTimes(1);
    expect(__mock.release).toHaveBeenCalledWith({ id: 'h1' });

    service.onApplicationShutdown();
  });

  test('exclusiveDistributed releases a lock after callback failure', async () => {
    const { __mock } = jest.requireMock('redlock-universal');
    __mock.acquire.mockResolvedValueOnce({ id: 'h2' });
    __mock.release.mockResolvedValueOnce(true);

    const service = createService();
    const callbackError = new Error('Schedule API is unavailable');

    await expect(
      service.exclusiveDistributed('dist-key', async () => {
        throw callbackError;
      }),
    ).rejects.toBe(callbackError);

    expect(__mock.release).toHaveBeenCalledWith({ id: 'h2' });

    service.onApplicationShutdown();
  });

  test('exclusiveDistributed maps a busy Redis lock to LockBusyError', async () => {
    const { LockAcquisitionError, __mock } =
      jest.requireMock('redlock-universal');
    __mock.acquire.mockRejectedValueOnce(new LockAcquisitionError('busy'));

    const service = createService();

    await expect(
      service.exclusiveDistributed('dist-key', async () => 'never'),
    ).rejects.toMatchObject({
      name: LockBusyError.name,
      key: 'dist-key',
    });
    expect(__mock.release).not.toHaveBeenCalled();

    service.onApplicationShutdown();
  });
});
