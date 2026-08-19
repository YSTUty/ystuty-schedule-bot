import { SelectGroupScene } from './select-group.scene';

describe('SelectGroupScene', () => {
  it('saves a group selected by an authorized group-chat callback', async () => {
    const keyboardFactory = { getStart: jest.fn().mockReturnValue({}) };
    const scheduleService = {
      getGroupByName: jest.fn().mockReturnValue('ЦИС-17'),
      parseGroupName: jest.fn(),
    };
    const scene = new SelectGroupScene(
      keyboardFactory as any,
      scheduleService as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      chat: { type: 'group' },
      callbackQuery: { data: 'selectGroup:ЦИС-17' },
      state: { appeal: false },
      scene: {
        state: { groupName: 'ЦИС-17', firstTime: false },
        leave: jest.fn(),
      },
      conversation: { groupName: 'ЦИС-11' },
      userSocial: {},
      i18n: { t: jest.fn().mockReturnValue('Группа выбрана') },
      replyWithHTML: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(ctx.conversation.groupName).toBe('ЦИС-17');
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(ctx.replyWithHTML).toHaveBeenCalledTimes(1);
  });
});
