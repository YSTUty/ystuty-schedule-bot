import { of, throwError } from 'rxjs';

import { LockBusyError } from '@my-common/exception';
import { WeekNumberType } from '@my-interfaces';

import { ScheduleService } from './schedule.service';

describe('ScheduleService', () => {
  let service: ScheduleService;

  const scheduleItems = () => [{ number: 1, days: [] }] as any;

  const createRedis = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    return {
      get: jest.fn(async (key: string) => values.get(key) || null),
      set: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      del: jest.fn(async (key: string) => values.delete(key)),
    };
  };

  const createConcurrency = () => ({
    buildKey: jest.fn((scope: string, ...parts: Array<string | number>) =>
      [scope, ...parts].join(':'),
    ),
    exclusiveDistributed: jest.fn(
      async (_key: string, callback: () => Promise<unknown>) =>
        await callback(),
    ),
  });

  beforeEach(() => {
    service = new ScheduleService({} as any, {} as any, {} as any, {} as any);
    (service as any).allTeachersList = [
      { id: 1, name: 'Шулева Анна Ивановна' },
      { id: 2, name: 'Петров Иван Сергеевич' },
    ];
  });

  describe('isTeacherSearchFallbackQuery', () => {
    it('accepts a partial surname that matches a teacher', () => {
      expect(service.isTeacherSearchFallbackQuery('Шулев')).toBe(true);
    });

    it('accepts full FIO tokens that match the same teacher', () => {
      expect(service.isTeacherSearchFallbackQuery('Шулева Анна')).toBe(true);
    });

    it('rejects queries shorter than five normalized characters', () => {
      expect(service.isTeacherSearchFallbackQuery('Иван')).toBe(false);
    });

    it('rejects text that does not match a teacher FIO token', () => {
      expect(service.isTeacherSearchFallbackQuery('аудитория')).toBe(false);
    });
  });

  describe('reference data loading logs', () => {
    it('logs groups only after the first load and when their content changes', async () => {
      const metricsService = { setScheduleReferenceCounts: jest.fn() };
      const httpService = {
        get: jest
          .fn()
          .mockReturnValueOnce(
            of({
              data: {
                items: [{ name: 'ИИТ', groups: ['ЦИС-17', 'ЦИС-18'] }],
              },
            }),
          )
          .mockReturnValueOnce(
            of({
              data: {
                items: [{ name: 'ИИТ', groups: ['ЦИС-18', 'ЦИС-17'] }],
              },
            }),
          )
          .mockReturnValueOnce(
            of({
              data: {
                items: [{ name: 'ИИТ', groups: ['ЦИС-17'] }],
              },
            }),
          ),
      };
      service = new ScheduleService(
        httpService as any,
        {} as any,
        {} as any,
        metricsService as any,
      );
      const log = jest.spyOn((service as any).logger, 'log');

      await (service as any).loadAllGroups();
      await (service as any).loadAllGroups();
      await (service as any).loadAllGroups();

      expect(log).toHaveBeenNthCalledWith(
        1,
        'YSTU institutes&groups loaded: (1&2)',
      );
      expect(log).toHaveBeenNthCalledWith(
        2,
        'YSTU institutes&groups updated: (1&1)',
      );
      expect(log).toHaveBeenCalledTimes(2);
      expect(
        metricsService.setScheduleReferenceCounts,
      ).toHaveBeenLastCalledWith({
        institutesCount: 1,
        groupsCount: 1,
      });
    });

    it('logs teachers only after the first load and when their content changes', async () => {
      const httpService = {
        get: jest
          .fn()
          .mockReturnValueOnce(
            of({ data: { items: [{ id: 2, name: 'Петров' }] } }),
          )
          .mockReturnValueOnce(
            of({ data: { items: [{ id: 2, name: 'Петров' }] } }),
          )
          .mockReturnValueOnce(
            of({ data: { items: [{ id: 2, name: 'Петров Пётр' }] } }),
          ),
      };
      service = new ScheduleService(
        httpService as any,
        {} as any,
        {} as any,
        {} as any,
      );
      const log = jest.spyOn((service as any).logger, 'log');

      await (service as any).loadAllTeachers();
      await (service as any).loadAllTeachers();
      await (service as any).loadAllTeachers();

      expect(log).toHaveBeenNthCalledWith(1, 'YSTU teachers loaded: (1)');
      expect(log).toHaveBeenNthCalledWith(2, 'YSTU teachers updated: (1)');
      expect(log).toHaveBeenCalledTimes(2);
    });
  });

  describe('schedule availability metrics', () => {
    it('counts all raw lesson records for every group', async () => {
      const metricsService = {
        setScheduleGroupLessonCounts: jest.fn(),
      };
      const httpService = {
        get: jest.fn((url: string) => {
          if (url.includes(encodeURIComponent('ЦИС-17'))) {
            return of({
              data: {
                isCache: false,
                items: [
                  {
                    number: 1,
                    days: [
                      {
                        info: { date: '2026-09-03' },
                        lessons: [{}, {}],
                      },
                      {
                        info: { date: '2026-09-04' },
                        lessons: [{}],
                      },
                    ],
                  },
                ],
              },
            });
          }

          return of({ data: { isCache: false, items: [] } });
        }),
      };
      service = new ScheduleService(
        httpService as any,
        {} as any,
        {} as any,
        metricsService as any,
      );
      (service as any).allowCaching = false;
      (service as any).allGroupsList = [
        { name: 'ИИТ', groups: ['ЦИС-17', 'ЦИС-18'] },
      ];
      jest
        .spyOn(service as any, 'isScheduleAvailabilityMetricsEnabled')
        .mockReturnValue(true);

      await (service as any).refreshScheduleAvailabilityMetrics();

      expect(metricsService.setScheduleGroupLessonCounts).toHaveBeenCalledWith([
        {
          groupName: 'ЦИС-17',
          instituteName: 'ИИТ',
          lessonsCount: 3,
        },
        {
          groupName: 'ЦИС-18',
          instituteName: 'ИИТ',
          lessonsCount: 0,
        },
      ]);
    });

    it('keeps the previous snapshot when at least one group request fails', async () => {
      const metricsService = {
        setScheduleGroupLessonCounts: jest.fn(),
      };
      service = new ScheduleService(
        {
          get: jest.fn(() => throwError(() => new Error('Schedule API down'))),
        } as any,
        {} as any,
        {} as any,
        metricsService as any,
      );
      (service as any).allowCaching = false;
      (service as any).allGroupsList = [{ name: 'ИИТ', groups: ['ЦИС-17'] }];
      jest
        .spyOn(service as any, 'isScheduleAvailabilityMetricsEnabled')
        .mockReturnValue(true);

      await (service as any).refreshScheduleAvailabilityMetrics();

      expect(
        metricsService.setScheduleGroupLessonCounts,
      ).not.toHaveBeenCalled();
    });
  });

  describe('raw schedule cache', () => {
    const cacheKey = 'schedule:group:цис-46';

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns a fresh Redis snapshot without an upstream request', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T08:00:00Z'));
      const redis = createRedis({
        [cacheKey]: JSON.stringify({
          fetchedAt: '2026-09-16T07:58:00Z',
          items: scheduleItems(),
        }),
      });
      const httpService = { get: jest.fn() };
      service = new ScheduleService(
        httpService as any,
        createConcurrency() as any,
        { redis } as any,
        {} as any,
      );

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'fresh',
        isCache: true,
        items: scheduleItems(),
      });
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('keeps compatibility with the legacy array-only cache payload', async () => {
      const redis = createRedis({
        [cacheKey]: JSON.stringify(scheduleItems()),
      });
      const httpService = { get: jest.fn() };
      service = new ScheduleService(
        httpService as any,
        createConcurrency() as any,
        { redis } as any,
        {} as any,
      );

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'fresh',
        isCache: true,
      });
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('starts a background refresh for a five-to-fifteen-minute-old snapshot', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T08:00:00Z'));
      const redis = createRedis({
        [cacheKey]: JSON.stringify({
          fetchedAt: '2026-09-16T07:52:00Z',
          items: scheduleItems(),
        }),
      });
      service = new ScheduleService(
        { get: jest.fn() } as any,
        createConcurrency() as any,
        { redis } as any,
        {} as any,
      );
      const refresh = jest
        .spyOn(service as any, 'refreshScheduleInBackground')
        .mockImplementation(() => undefined);

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'soft_stale',
        isCache: true,
      });
      expect(refresh).toHaveBeenCalledWith({
        cacheKey,
        targetId: 'ЦИС-46',
        targetType: 'group',
      });
    });

    it('serves stale data and records a short cooldown when Schedule API is unavailable', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T08:00:00Z'));
      const redis = createRedis({
        [cacheKey]: JSON.stringify({
          fetchedAt: '2026-09-16T07:40:00Z',
          items: scheduleItems(),
        }),
      });
      const httpService = {
        get: jest.fn(() => throwError(() => new Error('Schedule API down'))),
      };
      service = new ScheduleService(
        httpService as any,
        createConcurrency() as any,
        { redis } as any,
        {} as any,
      );

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'stale',
        isCache: true,
      });
      expect(redis.set).toHaveBeenCalledWith(
        `${cacheKey}:refresh-failed`,
        '1',
        'EX',
        60,
      );
    });

    it('does not retry Schedule API while the failed-refresh cooldown exists', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T08:00:00Z'));
      const redis = createRedis({
        [cacheKey]: JSON.stringify({
          fetchedAt: '2026-09-16T07:40:00Z',
          items: scheduleItems(),
        }),
        [`${cacheKey}:refresh-failed`]: '1',
      });
      const httpService = { get: jest.fn() };
      service = new ScheduleService(
        httpService as any,
        createConcurrency() as any,
        { redis } as any,
        {} as any,
      );

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'stale',
        isCache: true,
      });
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('stores an upstream response with a long fallback retention', async () => {
      const redis = createRedis();
      const httpService = {
        get: jest.fn(() =>
          of({ data: { isCache: false, items: scheduleItems() } }),
        ),
      };
      service = new ScheduleService(
        httpService as any,
        createConcurrency() as any,
        { redis } as any,
        {} as any,
      );

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'upstream',
        isCache: false,
      });
      expect(redis.set).toHaveBeenCalledWith(
        cacheKey,
        expect.stringContaining('"fetchedAt"'),
        'EX',
        14 * 24 * 60 * 60,
      );
    });

    it('returns the last snapshot when another worker already refreshes it', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T08:00:00Z'));
      const redis = createRedis({
        [cacheKey]: JSON.stringify({
          fetchedAt: '2026-09-16T07:40:00Z',
          items: scheduleItems(),
        }),
      });
      const concurrency = createConcurrency();
      concurrency.exclusiveDistributed.mockRejectedValue(
        new LockBusyError('Refresh is busy'),
      );
      service = new ScheduleService(
        { get: jest.fn() } as any,
        concurrency as any,
        { redis } as any,
        {} as any,
      );

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'stale',
        isCache: true,
      });
    });

    it('does not wait for an already running local refresh when stale data exists', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T08:00:00Z'));
      const redis = createRedis({
        [cacheKey]: JSON.stringify({
          fetchedAt: '2026-09-16T07:40:00Z',
          items: scheduleItems(),
        }),
      });
      service = new ScheduleService(
        { get: jest.fn() } as any,
        createConcurrency() as any,
        { redis } as any,
        {} as any,
      );
      (service as any).inFlightScheduleRefreshes.set(
        cacheKey,
        new Promise(() => undefined),
      );

      await expect(
        service.getSchedule('ЦИС-46', 'group'),
      ).resolves.toMatchObject({
        cacheState: 'stale',
        isCache: true,
      });
    });

    it('adds a calm cache marker only for a stale fallback response', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T08:00:00Z'));
      expect(
        (service as any).appendScheduleCacheNotice('Расписание', {
          cacheState: 'stale',
          fetchedAt: new Date('2026-09-16T07:30:00Z'),
        }),
      ).toBe('Расписание\n\n♻️');
      expect(
        (service as any).appendScheduleCacheNotice('Расписание', {
          cacheState: 'stale',
          fetchedAt: new Date('2026-09-16T05:30:00Z'),
        }),
      ).toContain('♻️ Обновлено: 16 сентября');
      expect(
        (service as any).appendScheduleCacheNotice('Расписание', {
          cacheState: 'fresh',
          fetchedAt: new Date('2026-09-16T05:30:00Z'),
        }),
      ).toBe('Расписание');
    });
  });

  describe('weekly navigation', () => {
    it('returns only adjacent weeks that have calendar dates in the schedule', async () => {
      const metricsService = { incrementScheduleRequest: jest.fn() };
      service = new ScheduleService(
        {} as any,
        {} as any,
        {} as any,
        metricsService as any,
      );
      jest.spyOn(service, 'getSchedule').mockResolvedValue({
        cacheState: 'fresh',
        fetchedAt: new Date('2026-09-16T08:00:00Z'),
        isCache: true,
        items: [
          {
            number: 1,
            days: [
              {
                info: {
                  type: WeekNumberType.Monday,
                  date: '2026-09-07T00:00:00+03:00',
                  weekNumber: 1,
                },
                lessons: [],
              },
            ],
          },
          {
            number: 2,
            days: [
              {
                info: {
                  type: WeekNumberType.Monday,
                  date: '2026-09-14T00:00:00+03:00',
                  weekNumber: 2,
                },
                lessons: [],
              },
            ],
          },
          {
            number: 3,
            days: [
              {
                info: {
                  type: WeekNumberType.Monday,
                  date: '2026-09-21T00:00:00+03:00',
                  weekNumber: 3,
                },
                lessons: [],
              },
            ],
          },
        ],
      });

      const result = await service.getScheduleWeekView({
        targetId: 'ЦИС-46',
        targetType: 'group',
        requestedWeekNumber: 2,
      });

      expect(result).toMatchObject({
        weekNumber: 2,
        dateRange: '14–20 сентября',
        previousWeekNumber: 1,
        nextWeekNumber: 3,
      });
      expect(metricsService.incrementScheduleRequest).toHaveBeenCalledWith(
        'group',
        'ЦИС-46',
      );
    });
  });
});
