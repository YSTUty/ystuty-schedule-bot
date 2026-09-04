import { SocialType } from '@my-common/constants';

import { BroadcastAudienceFilterService } from './broadcast-audience-filter.service';

describe('BroadcastAudienceFilterService', () => {
  it('passes authorization and group filters to the audience query', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new BroadcastAudienceFilterService(
      repository as any,
      {
        getGroupInstitutes: jest.fn(),
      } as any,
    );

    await service.getRecipients(SocialType.Telegram, {
      onlyAuthorized: true,
      groupName: 'ЦИС-21',
    });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where).toMatchObject({
      social: SocialType.Telegram,
      hasDM: true,
      isBlockedBot: false,
    });
    expect(where.groupName._value).toEqual(['ЦИС-21']);
    expect(where.userId).toBeDefined();
  });

  it('uses a single IN condition for selected groups', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new BroadcastAudienceFilterService(
      repository as any,
      {
        getGroupInstitutes: jest.fn(),
      } as any,
    );

    await service.getRecipients(SocialType.Vkontakte, {
      groupNames: ['ЦПИ-22', 'ЦИС-21', 'ЦИС-21'],
    });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where.groupName).toBeDefined();
    expect(where.groupName._value).toEqual(['ЦИС-21', 'ЦПИ-22']);
  });

  it('filters explicitly unauthorized profiles by a missing user binding', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    const service = new BroadcastAudienceFilterService(
      repository as any,
      { getGroupInstitutes: jest.fn() } as any,
    );

    await service.getRecipients(SocialType.Telegram, { onlyAuthorized: false });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where.userId).toBeDefined();
  });

  it('builds preview only from groups with eligible recipients', async () => {
    const repository = {
      find: jest
        .fn()
        .mockResolvedValue([
          { groupName: 'ЦИС-21' },
          { groupName: 'ЦИС-21' },
          { groupName: 'ЦПИ-22' },
          { groupName: null },
        ]),
    };
    const scheduleService = {
      getGroupInstitutes: jest.fn().mockReturnValue([
        { name: 'Институт 1', groups: ['ЦИС-21'] },
        { name: 'Институт 2', groups: ['ЦПИ-22'] },
      ]),
    };
    const service = new BroadcastAudienceFilterService(
      repository as any,
      scheduleService as any,
    );

    const preview = await service.getGroupsPreview(SocialType.Telegram, {
      groupNames: ['ЦИС-21'],
    });

    expect(scheduleService.getGroupInstitutes).toHaveBeenCalledWith([
      'ЦИС-21',
      'ЦПИ-22',
    ]);
    expect(preview.selectedRecipientsCount).toBe(2);
    expect(preview.institutes).toEqual([
      {
        instituteName: 'Институт 1',
        recipientsCount: 2,
        groups: [{ groupName: 'ЦИС-21', recipientsCount: 2 }],
      },
      {
        instituteName: 'Институт 2',
        recipientsCount: 1,
        groups: [{ groupName: 'ЦПИ-22', recipientsCount: 1 }],
      },
    ]);
  });

  it('passes activity and previous campaign exclusions to the audience query', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new BroadcastAudienceFilterService(
      repository as any,
      {
        getGroupInstitutes: jest.fn(),
      } as any,
    );

    await service.getRecipients(SocialType.Telegram, {
      lastInteractionAfter: '2026-08-01',
      excludeCampaignIds: [11, 4, 11, 0],
    });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where.lastInteractionAt).toBeDefined();
    expect(where.id).toBeDefined();
    expect(where.id.objectLiteralParameters).toEqual({
      excludeCampaignIds: [4, 11],
    });
  });

  it('selects only rate-limited recipients of the selected Telegram campaign', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new BroadcastAudienceFilterService(
      repository as any,
      {
        getGroupInstitutes: jest.fn(),
      } as any,
    );

    await service.getRecipients(SocialType.Telegram, {
      retryRateLimitCampaignId: 4,
    });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where.id).toMatchObject({
      objectLiteralParameters: { retryRateLimitCampaignId: 4 },
    });
    expect(where.id._getSql('id')).toContain('"failureKind" = \'rate_limit\'');
    expect(where.id._getSql('id')).toContain('too many requests');
  });

  it('ignores the Telegram rate-limit retry filter for VK recipients', () => {
    const service = new BroadcastAudienceFilterService(
      {} as any,
      { getGroupInstitutes: jest.fn() } as any,
    );

    expect(
      service.normalizeFilter(SocialType.Vkontakte, {
        retryRateLimitCampaignId: 4,
      }),
    ).not.toHaveProperty('retryRateLimitCampaignId');
  });

  it('includes profiles without activity alongside a selected date filter', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new BroadcastAudienceFilterService(
      repository as any,
      { getGroupInstitutes: jest.fn() } as any,
    );

    await service.getRecipients(SocialType.Telegram, {
      lastInteractionAfter: '2026-08-31T00:00:00+03:00',
      includeNoActivity: true,
    });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where.lastInteractionAt).toMatchObject({
      _objectLiteralParameters: {
        lastInteractionAfter: new Date('2026-08-30T21:00:00.000Z'),
      },
    });
    expect(where.lastInteractionAt._getSql('lastInteractionAt')).toContain(
      'lastInteractionAt IS NULL',
    );
    expect(where.lastInteractionAt._getSql('lastInteractionAt')).toContain(
      'lastInteractionAt >= :lastInteractionAfter',
    );
  });

  it('accepts an inclusive Moscow date range as a UTC half-open interval', () => {
    const service = new BroadcastAudienceFilterService(
      {} as any,
      { getGroupInstitutes: jest.fn() } as any,
    );
    const filter = service.normalizeFilter(SocialType.Telegram, {
      lastInteractionAfter: '2026-08-01T00:00:00+03:00',
      lastInteractionBefore: '2026-08-02T00:00:00+03:00',
    });

    expect(filter.lastInteractionAfter).toBe('2026-07-31T21:00:00.000Z');
    expect(filter.lastInteractionBefore).toBe('2026-08-01T21:00:00.000Z');
  });
});
