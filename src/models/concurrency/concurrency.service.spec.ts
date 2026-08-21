import { LockBusyError } from '@my-common/exception';

import { ConcurrencyService } from './concurrency.service';

jest.mock('redlock-universal', () => {
  const acquire = jest.fn();
  const release = jest.fn();

  return {
    __esModule: true,
    IoredisAdapter: {
      from: jest.fn(() => ({ type: 'adapter' })),
    },
    createLock: jest.fn(() => ({ acquire, release })),
    createRedlock: jest.fn(() => ({ acquire, release })),
    __mock: { acquire, release },
  };
});

describe('ConcurrencyService', () => {
  const createService = () => new ConcurrencyService({ redis: {} } as any);

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
  });
});
