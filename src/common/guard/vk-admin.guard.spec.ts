import { VkException, VkExecutionContext } from 'nestjs-vk';
import { Logger } from '@nestjs/common';

import { VkExceptionFilter } from '../filter/vk-exception.filter';
import { VkAdminGuard } from './vk-admin.guard';

describe('VkAdminGuard', () => {
  it('continues a non-admin message event marked for skipping', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const next = jest.fn();
    const handler = jest.fn();
    const context = {
      getArgs: () => [
        {
          type: 'message_event',
          senderId: 1,
          peerId: 1,
          state: {},
        },
        next,
      ],
      getClass: () => class TestUpdate {},
      getHandler: () => handler,
      getType: () => 'vk-io',
    } as unknown as VkExecutionContext;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    };
    const Guard = VkAdminGuard(true);
    const guard = new Guard(reflector as never);

    try {
      guard.canActivate(context);
    } catch (exception) {
      await new VkExceptionFilter().catch(
        exception as Error,
        context,
      );
    }

    expect(next).toHaveBeenCalledTimes(1);
    expect(loggerError).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
