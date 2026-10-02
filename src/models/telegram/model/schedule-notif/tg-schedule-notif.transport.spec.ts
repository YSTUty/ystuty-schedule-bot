import { SocialType } from '@my-common/constants';

import { TgScheduleNotifTransport } from './tg-schedule-notif.transport';

describe('TgScheduleNotifTransport', () => {
  const createTransport = () => {
    const telegramService = {
      isActive: true,
      sendMessage: jest.fn(),
      sendMessageOrThrow: jest.fn().mockResolvedValue({ message_id: 42 }),
    };
    const transportRegistry = { register: jest.fn() };

    return {
      telegramService,
      transport: new TgScheduleNotifTransport(
        telegramService as any,
        transportRegistry as any,
      ),
    };
  };

  it('sends trusted HTML and preserves Telegram API errors for queue retries', async () => {
    const { transport, telegramService } = createTransport();

    await expect(
      transport.sendScheduleNotif({
        recipient: {
          type: 'user',
          userSocial: {
            social: SocialType.Telegram,
            socialId: 123,
          } as any,
        },
        text: 'Расписание',
        html: '<b>Расписание</b>',
      }),
    ).resolves.toEqual({ messageId: '42' });

    expect(telegramService.sendMessageOrThrow).toHaveBeenCalledWith(
      123,
      '<b>Расписание</b>',
    );
    expect(telegramService.sendMessage).not.toHaveBeenCalled();
  });
});
