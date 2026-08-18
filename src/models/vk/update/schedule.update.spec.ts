import { ScheduleUpdate } from './schedule.update';

describe('VK ScheduleUpdate', () => {
  it('uses the persistent conversation group for a chat schedule', async () => {
    const scheduleService = {
      getGroupByName: jest.fn((groupName) => groupName),
      parseGroupName: jest.fn(),
    };
    const update = new ScheduleUpdate(scheduleService as any, {} as any);
    const ctx = {
      isChat: true,
      state: {
        conversation: { groupName: 'ЦИС-21' },
        userSocial: { groupName: 'ЦИС-11' },
      },
      sessionConversation: {},
      $match: { groups: {} },
      scene: { enter: jest.fn() },
      send: jest.fn(),
    } as any;

    const target = await (update as any).resolveScheduleTarget(
      ctx,
      undefined,
      false,
    );

    expect(target).toEqual({ id: 'ЦИС-21', type: 'group', name: 'ЦИС-21' });
    expect(scheduleService.getGroupByName).toHaveBeenCalledWith('ЦИС-21');
    expect(ctx.scene.enter).not.toHaveBeenCalled();
  });
});
