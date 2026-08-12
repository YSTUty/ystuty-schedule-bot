import { SocialType } from '@my-common/constants';

import { ScheduleNotifTransportRegistry } from './schedule-notif-transport.registry';

describe('ScheduleNotifTransportRegistry', () => {
  it('returns a registered Telegram transport and rejects missing transports', () => {
    const registry = new ScheduleNotifTransportRegistry();
    const telegramTransport = {
      social: SocialType.Telegram,
      sendMessage: jest.fn(),
      sendScheduleNotif: jest.fn(),
    };
    registry.register(telegramTransport);

    expect(registry.get(SocialType.Telegram)).toBe(telegramTransport);
    expect(() => registry.get(SocialType.Vkontakte)).toThrow(
      'Schedule notif transport is not registered: vkontakte',
    );
  });
});
