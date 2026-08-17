import { ScheduleUpdate } from './schedule.update';

describe('Telegram ScheduleUpdate', () => {
  const createUpdate = () => {
    const ystutyService = {
      getGroupByName: jest.fn((groupName) => groupName),
      parseGroupName: jest.fn(),
    };

    return {
      update: new ScheduleUpdate({} as any, ystutyService as any),
      ystutyService,
    };
  };

  it('uses the persistent conversation group for a group chat schedule', async () => {
    const { update, ystutyService } = createUpdate();
    const ctx = {
      chat: { type: 'group' },
      conversation: { groupName: 'ЦИС-21' },
      sessionConversation: {},
      userSocial: { groupName: 'ЦИС-11' },
      match: { groups: {} },
      scene: { enter: jest.fn() },
      replyWithHTML: jest.fn(),
    } as any;

    await (update as any).resolveGroupName(ctx);

    expect(ystutyService.getGroupByName).toHaveBeenCalledWith('ЦИС-21');
    expect(ctx.scene.enter).not.toHaveBeenCalled();
  });
});
