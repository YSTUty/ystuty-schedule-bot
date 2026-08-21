import { SocialService } from './social.service';

describe('SocialService', () => {
  const service = Object.create(SocialService.prototype) as SocialService;

  it('restores an unavailable conversation when it produces an inbound update', () => {
    const conversation = { isLeaved: true, chatStatus: 'kicked' } as any;

    expect(service.restoreConversationFromInboundUpdate(conversation)).toBe(
      true,
    );
    expect(conversation).toEqual({ isLeaved: false, chatStatus: null });
  });

  it('does not clear a known status for an already active conversation', () => {
    const conversation = { isLeaved: false, chatStatus: 'member' } as any;

    expect(service.restoreConversationFromInboundUpdate(conversation)).toBe(
      false,
    );
    expect(conversation).toEqual({ isLeaved: false, chatStatus: 'member' });
  });
});
