import { VkGroupPicker } from './vk-group-picker';

describe('VkGroupPicker', () => {
  const ctx = {
    i18n: { t: jest.fn(() => 'Группы') },
  } as any;

  const createPicker = (groups: string[]) => {
    const scheduleService = {
      groupsList: jest.fn(() => ({
        items: groups,
        currentPage: 1,
        totalPages: 1,
      })),
      instituteNameByHash: jest.fn(() => 'ИИТ'),
    };
    const keyboardFactory = { getPagination: jest.fn(() => 'keyboard') };

    return {
      picker: new VkGroupPicker(scheduleService as any, keyboardFactory as any),
      keyboardFactory,
    };
  };

  it('moves a short final group into a pair and gives the longest group a full row', () => {
    const { picker, keyboardFactory } = createPicker([
      'Короткая',
      'Очень длинное название группы, которое иначе будет обрезано',
      'А',
    ]);

    picker.renderGroups(ctx, 'institute-hash', 1, {
      onItem: (groupName) => ({ groupName }),
      onPage: () => ({}),
      groupColumns: 2,
    });

    expect(keyboardFactory.getPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          [
            expect.objectContaining({ title: 'Короткая' }),
            expect.objectContaining({ title: 'А' }),
          ],
          [
            expect.objectContaining({
              title:
                'Очень длинное название группы, которое иначе будет обрезано',
            }),
          ],
        ],
      }),
    );
  });

  it('keeps the original order when the final group is not shorter than a pair', () => {
    const { picker, keyboardFactory } = createPicker([
      'Короткая',
      'Средняя',
      'Очень длинное название последней группы',
    ]);

    picker.renderGroups(ctx, 'institute-hash', 1, {
      onItem: (groupName) => ({ groupName }),
      onPage: () => ({}),
      groupColumns: 2,
    });

    expect(keyboardFactory.getPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          [
            expect.objectContaining({ title: 'Короткая' }),
            expect.objectContaining({ title: 'Средняя' }),
          ],
          [
            expect.objectContaining({
              title: 'Очень длинное название последней группы',
            }),
          ],
        ],
      }),
    );
  });
});
