import { AdminUpdate } from './admin.update';

describe('AdminUpdate', () => {
  it('reports every loaded group that does not match the group-name pattern', async () => {
    const ystutyService = {
      groupNames: ['ЦИС-18', 'Не группа'],
    };
    const update = new AdminUpdate(
      {} as any,
      {} as any,
      ystutyService as any,
    );
    const ctx = { replyWithHTML: jest.fn() } as any;

    await update.onCheckGroupPatterns(ctx);

    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      expect.stringContaining('Не распознано: <b>1</b>'),
    );
    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      expect.stringContaining('<code>Не группа</code>'),
    );
  });
});
