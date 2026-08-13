import { MainUpdate } from './main.update';

describe('VK MainUpdate', () => {
  const openTeachersList = jest.fn();
  const isTeacherSearchFallbackQuery = jest.fn();
  const update = new MainUpdate(
    {} as any,
    {} as any,
    { isTeacherSearchFallbackQuery } as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (update as any).openTeachersList = openTeachersList;
  });

  it('opens a filtered teacher list for a matching fallback message in a DM', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(true);
    const ctx = { isDM: true, text: 'Шулев' } as any;

    await update.onHearFallback(ctx);

    expect(openTeachersList).toHaveBeenCalledWith(ctx, 'Шулев');
  });

  it('ignores fallback text in a VK group chat', async () => {
    const ctx = { isDM: false, text: 'Шулев' } as any;

    await update.onHearFallback(ctx);

    expect(openTeachersList).not.toHaveBeenCalled();
    expect(isTeacherSearchFallbackQuery).not.toHaveBeenCalled();
  });
});
