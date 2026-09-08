import { SocialType } from '@my-common/constants';

import { VkScheduleNotifTransport } from './vk-schedule-notif.transport';

describe('VkScheduleNotifTransport', () => {
  const createTransport = () => {
    const vkService = {
      isActive: true,
      sendMessageOrThrow: jest.fn().mockResolvedValue([
        {
          conversation_message_id: 42,
        },
      ]),
    };
    const transportRegistry = {
      register: jest.fn(),
    };

    return {
      vkService,
      transport: new VkScheduleNotifTransport(
        vkService as any,
        transportRegistry as any,
      ),
    };
  };

  it('sends conversation notifications to VK peer id, not raw chat id', async () => {
    const { transport, vkService } = createTransport();

    await transport.sendScheduleNotif({
      recipient: { type: 'conversation', conversationId: 1 },
      text: 'Расписание',
    });

    expect(vkService.sendMessageOrThrow).toHaveBeenCalledWith(
      2000000001,
      'Расписание',
    );
  });

  it('keeps personal notification recipient id unchanged', async () => {
    const { transport, vkService } = createTransport();

    await transport.sendScheduleNotif({
      recipient: {
        type: 'user',
        userSocial: {
          social: SocialType.Vkontakte,
          socialId: 123,
        } as any,
      },
      text: 'Расписание',
    });

    expect(vkService.sendMessageOrThrow).toHaveBeenCalledWith(
      123,
      'Расписание',
    );
  });

  it('accepts a numeric VK message id for a single recipient', async () => {
    const { transport, vkService } = createTransport();
    vkService.sendMessageOrThrow.mockResolvedValue(42);

    await expect(
      transport.sendScheduleNotif({
        recipient: { type: 'conversation', conversationId: 1 },
        text: 'Расписание',
      }),
    ).resolves.toEqual({ messageId: '42' });
  });
});
