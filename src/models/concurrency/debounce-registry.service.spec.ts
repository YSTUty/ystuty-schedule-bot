import { DebounceRegistryService } from './debounce-registry.service';

describe('DebounceRegistryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('buildKey creates normalized debounce key from scopes and key', () => {
    const service = new DebounceRegistryService();
    expect(service.buildKey(['tg', 'cooldown'], 10001)).toBe(
      'debounce:tg:cooldown:10001',
    );
  });

  test('checkAndMark blocks repeated calls inside debounce window', () => {
    const service = new DebounceRegistryService();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000);
    nowSpy.mockReturnValueOnce(2_000);
    nowSpy.mockReturnValueOnce(3_500);
    const key = service.buildKey(['tg', 'cooldown'], 10001);

    expect(service.checkAndMark(key, 2_000)).toBe(true);
    expect(service.checkAndMark(key, 2_000)).toBe(false);
    expect(service.checkAndMark(key, 2_000)).toBe(true);
  });

  test('clear removes existing debounce key', () => {
    const service = new DebounceRegistryService();
    const key = service.buildKey(['tg', 'cooldown'], 10001);
    service.mark(key, 1_000);
    service.clear(key);

    expect(service.check(key, 2_000, 1_500)).toBe(true);
  });
});
