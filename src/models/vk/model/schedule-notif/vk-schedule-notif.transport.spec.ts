import { SocialType } from '@my-common/constants';

import { VkScheduleNotifTransport } from './vk-schedule-notif.transport';

describe('VkScheduleNotifTransport', () => {
  const createTransport = () => {
    const vkService = {
      isActive: true,
      sendMessage: jest.fn().mockResolvedValue([
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

    expect(vkService.sendMessage).toHaveBeenCalledWith(
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

    expect(vkService.sendMessage).toHaveBeenCalledWith(123, 'Расписание');
  });
});
