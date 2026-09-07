import { oAuth } from '@my-common';
import { SocialType } from '@my-common/constants';

import { UserService } from './user.service';

describe('UserService authUserSocial', () => {
  const oauthUserData = {
    auth_info: {
      user: {
        id: 1001,
        fullName: 'Иванов Иван Иванович',
        login: 'ivanov',
        groupName: 'ЦИС-46',
      },
    },
  };

  const createService = () =>
    new UserService(
      {} as any,
      {} as any,
      {} as any,
      {
        exclusiveLocal: jest.fn(async (_key, callback) => callback()),
        buildKey: jest.fn(),
      } as any,
      { userCounter: { inc: jest.fn() } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

  beforeEach(() => {
    jest
      .spyOn(oAuth as any, 'getProtectedResource')
      .mockImplementation(
        (
          _url: string,
          _accessToken: string,
          callback: (error: Error | null, result?: string) => void,
        ) => {
          callback(null, JSON.stringify(oauthUserData));
        },
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates tokens and profile data after reauthorizing the same YSTU ID', async () => {
    const service = createService();
    const userSocial = {
      userId: 10,
      user: {
        id: 10,
        externalId: 1001,
        isRewoked: true,
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
      },
    };
    const savedUser = {
      ...userSocial.user,
      ...oauthUserData.auth_info.user,
      isRewoked: false,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    jest.spyOn(service, 'findBySocialId').mockResolvedValue(userSocial as any);
    jest.spyOn(service, 'save').mockResolvedValue(savedUser as any);
    const saveUserSocial = jest
      .spyOn(service, 'saveUserSocial')
      .mockResolvedValue(userSocial as any);

    const result = await service.authUserSocial(SocialType.Telegram, 42, {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    });

    expect(result).toEqual({
      status: 'refreshed',
      userSocial: { ...userSocial, user: savedUser },
    });
    expect(service.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        externalId: 1001,
        isRewoked: false,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    );
    expect(saveUserSocial).toHaveBeenCalledWith(
      expect.objectContaining({ user: savedUser }),
    );
  });

  it('does not overwrite a linked YSTU ID with another account', async () => {
    const service = createService();
    const userSocial = {
      userId: 10,
      user: {
        id: 10,
        externalId: 2002,
      },
    };

    jest.spyOn(service, 'findBySocialId').mockResolvedValue(userSocial as any);
    const save = jest.spyOn(service, 'save');
    const saveUserSocial = jest.spyOn(service, 'saveUserSocial');

    await expect(
      service.authUserSocial(SocialType.Vkontakte, 42, {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      }),
    ).resolves.toEqual({ status: 'identity_mismatch' });

    expect(save).not.toHaveBeenCalled();
    expect(saveUserSocial).not.toHaveBeenCalled();
  });

  it('closes the emulated session after a failed authorization result', async () => {
    const close = jest.fn();
    const telegramService = {
      isActive: true,
      emulateSession: jest.fn().mockResolvedValue([{}, close]),
      sendMessage: jest.fn(),
    };
    const service = new UserService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { userCounter: { inc: jest.fn() } } as any,
      telegramService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn(service, 'authUserSocial')
      .mockResolvedValue({ status: 'identity_mismatch' });

    await expect(
      service.auth(SocialType.Telegram, 42, {
        access_token: 'new-access-token',
      }),
    ).resolves.toBe(false);

    expect(close).toHaveBeenCalledTimes(1);
  });
});
