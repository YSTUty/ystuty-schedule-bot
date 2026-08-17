import { VkAdminGuard } from './vk-admin.guard';

describe('VkAdminGuard', () => {
  it('rejects a non-admin callback handler', () => {
    const context = {
      getArgs: () => [
        {
          type: 'message_event',
          senderId: 1,
          peerId: 1,
          state: {},
        },
        jest.fn(),
      ],
      getClass: () => class TestUpdate {},
      getHandler: jest.fn(),
      getType: () => 'vk-io',
    } as any;
    const Guard = VkAdminGuard(true);
    const guard = new Guard();

    expect(() => guard.canActivate(context)).toThrow('common.no_access');
  });
});
