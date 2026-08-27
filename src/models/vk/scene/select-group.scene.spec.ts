import { SelectGroupScene } from './select-group.scene';

describe('VK SelectGroupScene', () => {
  it('ignores a foreign callback while the group selection scene is active', async () => {
    const scheduleService = {
      getGroupByName: jest.fn(),
      parseGroupName: jest.fn(),
    };
    const scene = new SelectGroupScene(
      scheduleService as any,
      {} as any,
      {} as any,
    );
    const ctx = {
      eventPayload: {
        broadcastFeedbackAction: 'initial',
        deliveryId: 8,
      },
      is: jest.fn((types: string[]) => types.includes('message_event')),
      scene: {
        state: { forceNewMessage: true },
        step: { firstTime: false },
      },
      send: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(scheduleService.getGroupByName).not.toHaveBeenCalled();
    expect(scheduleService.parseGroupName).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('renders the initial group prompt from a recipient action callback', async () => {
    const keyboard = { inline: jest.fn().mockReturnValue('keyboard') };
    const scene = new SelectGroupScene(
      { randomGroupName: 'ЦИС-11' } as any,
      { getSelectGroupScene: jest.fn().mockReturnValue(keyboard) } as any,
      {} as any,
    );
    const ctx = {
      eventPayload: {
        deliveryId: 8,
        broadcastRecipientAction: 'select_group',
      },
      is: jest.fn((types: string[]) => types.includes('message_event')),
      isChat: false,
      state: { userSocial: {}, user: null },
      scene: { state: { forceNewMessage: true }, step: { firstTime: true } },
      i18n: { t: jest.fn().mockReturnValue('Выбери группу') },
      send: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(ctx.send).toHaveBeenCalledWith('Выбери группу', {
      keyboard: 'keyboard',
    });
  });

  it('saves a group selected by the scene callback', async () => {
    const scheduleService = {
      getGroupByName: jest.fn().mockReturnValue('ДПО'),
      parseGroupName: jest.fn(),
    };
    const keyboard = { inline: jest.fn().mockReturnValue('keyboard') };
    const scene = new SelectGroupScene(
      scheduleService as any,
      {
        getStart: jest.fn().mockReturnValue(keyboard),
        needInline: jest.fn().mockReturnValue(true),
      } as any,
      {} as any,
    );
    const ctx = {
      eventPayload: { groupAction: 'select', groupName: 'ДПО' },
      is: jest.fn((types: string[]) => types.includes('message_event')),
      isMessageEventContext: jest.fn().mockReturnValue(true),
      isChat: false,
      state: { userSocial: {} as { groupName?: string } },
      scene: {
        state: {},
        step: { firstTime: false },
        leave: jest.fn(),
      },
      i18n: { t: jest.fn().mockReturnValue('Группа выбрана') },
      editMessage: jest.fn(),
    };

    await scene.step1(ctx as any);

    expect(scheduleService.getGroupByName).toHaveBeenCalledWith('ДПО');
    expect(ctx.state.userSocial.groupName).toBe('ДПО');
    expect(ctx.editMessage).toHaveBeenCalledWith({
      message: 'Группа выбрана',
      keyboard: 'keyboard',
    });
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });
});
