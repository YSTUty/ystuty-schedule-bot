import { UserException } from '@my-common';

import { AuthScene } from './auth.scene';

describe('VK AuthScene', () => {
  it('leaves the one-step scene after sending an external auth link', async () => {
    const keyboard = { inline: jest.fn(() => 'inline keyboard') };
    const keyboardFactory = { getAuth: jest.fn(() => keyboard) };
    const socialConnectService = {
      isAvailable: true,
      requestAuth: jest.fn().mockResolvedValue({
        status: 'unauth',
        botName: 'ystu_connect',
        payload: 'auth-token',
      }),
    };
    const scene = new AuthScene(
      keyboardFactory as any,
      socialConnectService as any,
    );
    const ctx = {
      isDM: true,
      peerId: 42,
      state: { user: null },
      session: {},
      scene: { leave: jest.fn() },
      send: jest.fn(),
      i18n: { t: jest.fn(() => 'Открой ссылку') },
    } as any;

    await scene.step1(ctx);

    expect(ctx.scene.leave).toHaveBeenCalledWith({ silent: true });
    expect(ctx.send).toHaveBeenCalledWith('Открой ссылку', {
      keyboard: 'inline keyboard',
    });
  });

  it('leaves the scene before reporting an auth request error', async () => {
    const scene = new AuthScene(
      {} as any,
      {
        isAvailable: true,
        requestAuth: jest.fn().mockResolvedValue({ error: 'rate limit' }),
      } as any,
    );
    const ctx = {
      isDM: true,
      peerId: 42,
      state: { user: null },
      scene: { leave: jest.fn() },
    } as any;

    await expect(scene.step1(ctx)).rejects.toBeInstanceOf(UserException);
    expect(ctx.scene.leave).toHaveBeenCalledWith({ silent: true });
  });
});
