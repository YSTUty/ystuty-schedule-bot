import { ScheduleUpdate } from './schedule.update';

describe('Telegram ScheduleUpdate', () => {
  const createUpdate = () => {
    const scheduleService = {
      getGroupByName: jest.fn((groupName) => groupName),
      parseGroupName: jest.fn(),
    };

    return {
      update: new ScheduleUpdate({} as any, scheduleService as any),
      scheduleService,
    };
  };

  it('uses the persistent conversation group for a group chat schedule', async () => {
    const { update, scheduleService } = createUpdate();
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

    expect(scheduleService.getGroupByName).toHaveBeenCalledWith('ЦИС-21');
    expect(ctx.scene.enter).not.toHaveBeenCalled();
  });
});
