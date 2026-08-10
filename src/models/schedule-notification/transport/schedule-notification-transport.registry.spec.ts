import { SocialType } from '@my-common/constants';

import { ScheduleNotificationTransportRegistry } from './schedule-notification-transport.registry';

describe('ScheduleNotificationTransportRegistry', () => {
  it('returns a registered Telegram transport and rejects missing transports', () => {
    const registry = new ScheduleNotificationTransportRegistry();
    const telegramTransport = {
      social: SocialType.Telegram,
      sendScheduleNotification: jest.fn(),
    };
    registry.register(telegramTransport);

    expect(registry.get(SocialType.Telegram)).toBe(telegramTransport);
    expect(() => registry.get(SocialType.Vkontakte)).toThrow(
      'Schedule notification transport is not registered: vkontakte',
    );
  });
});
