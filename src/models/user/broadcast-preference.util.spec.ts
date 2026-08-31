import {
  isBroadcastUnsubscribeCallback,
  isBroadcastUnsubscribeEvent,
  isBroadcastUnsubscribeText,
} from './broadcast-preference.util';

describe('broadcast preference update detection', () => {
  it.each(['/unsubscribe', ' Отписаться ', 'БОЛЬШЕ НЕ СТУДЕНТ'])(
    'recognizes the unsubscribe command %s',
    (text) => {
      expect(isBroadcastUnsubscribeText(text)).toBe(true);
    },
  );

  it('does not suppress restoration for a regular interaction', () => {
    expect(isBroadcastUnsubscribeText('/start')).toBe(false);
    expect(isBroadcastUnsubscribeCallback('schedule:today')).toBe(false);
    expect(isBroadcastUnsubscribeEvent({ action: 'schedule' })).toBe(false);
  });

  it('recognizes both transport unsubscribe callbacks', () => {
    expect(
      isBroadcastUnsubscribeCallback('broadcast:unsubscribe:confirm'),
    ).toBe(true);
    expect(
      isBroadcastUnsubscribeCallback('broadcast:action:15:unsubscribe'),
    ).toBe(true);
    expect(
      isBroadcastUnsubscribeEvent({ broadcastRecipientAction: 'unsubscribe' }),
    ).toBe(true);
  });
});
