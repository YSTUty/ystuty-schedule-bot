import { TG_ALLOWED_CHAT_TYPES_KEY } from '@my-common/decorator/tg';

import { MainUpdate } from './main.update';

describe('Telegram MainUpdate', () => {
  const openTeachersList = jest.fn();
  const isTeacherSearchFallbackQuery = jest.fn();
  const update = new MainUpdate(
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

  it('opens a filtered teacher list for a matching private text message', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(true);
    const ctx = { message: { text: 'Шулев' } } as any;
    const next = jest.fn();

    await update.onTeacherNameFallback(ctx, next);

    expect(openTeachersList).toHaveBeenCalledWith(ctx, 'Шулев');
  });

  it('does not open a list for unrelated private text', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(false);
    const ctx = { message: { text: 'аудитория' } } as any;
    const next = jest.fn();

    await update.onTeacherNameFallback(ctx, next);

    expect(openTeachersList).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not continue handlers after opening a teacher list', async () => {
    isTeacherSearchFallbackQuery.mockReturnValue(true);
    const next = jest.fn();

    await update.onTeacherNameFallback(
      { message: { text: 'Шулев' } } as any,
      next,
    );

    expect(next).not.toHaveBeenCalled();
  });

  it('registers the fallback only for private Telegram chats', () => {
    expect(
      Reflect.getMetadata(
        TG_ALLOWED_CHAT_TYPES_KEY,
        MainUpdate.prototype.onTeacherNameFallback,
      ),
    ).toEqual(['private']);
  });
});
