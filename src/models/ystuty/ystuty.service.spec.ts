import { YSTUtyService } from './ystuty.service';

describe('YSTUtyService', () => {
  let service: YSTUtyService;

  beforeEach(() => {
    service = new YSTUtyService({} as any, {} as any, {} as any);
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
});
