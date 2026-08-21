import { of } from 'rxjs';

import { ScheduleService } from './schedule.service';

describe('ScheduleService', () => {
  let service: ScheduleService;

  beforeEach(() => {
    service = new ScheduleService({} as any, {} as any, {} as any);
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
      service = new ScheduleService(httpService as any, {} as any, {} as any);
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
      service = new ScheduleService(httpService as any, {} as any, {} as any);
      const log = jest.spyOn((service as any).logger, 'log');

      await (service as any).loadAllTeachers();
      await (service as any).loadAllTeachers();
      await (service as any).loadAllTeachers();

      expect(log).toHaveBeenNthCalledWith(1, 'YSTU teachers loaded: (1)');
      expect(log).toHaveBeenNthCalledWith(2, 'YSTU teachers updated: (1)');
      expect(log).toHaveBeenCalledTimes(2);
    });
  });
});
