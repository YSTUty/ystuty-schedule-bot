import { SocialType } from '@my-common/constants';

import { BroadcastAudienceFilterService } from './broadcast-audience-filter.service';

describe('BroadcastAudienceFilterService', () => {
  it('passes authorization and group filters to the audience query', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new BroadcastAudienceFilterService(repository as any);

    await service.getRecipients(SocialType.Telegram, {
      onlyAuthorized: true,
      groupName: 'ЦИС-21',
    });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where).toMatchObject({
      social: SocialType.Telegram,
      hasDM: true,
      isBlockedBot: false,
      groupName: 'ЦИС-21',
    });
    expect(where.userId).toBeDefined();
  });
});
