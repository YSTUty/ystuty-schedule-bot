import { UserException } from '@my-common';

import { AuthScene } from './auth.scene';

describe('Telegram AuthScene', () => {
  it('leaves the one-step scene after sending an external auth link', async () => {
    const keyboard = { reply_markup: { inline_keyboard: [] } };
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
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      user: null,
      scene: { state: {}, leave: jest.fn() },
      tryAnswerCbQuery: jest.fn(),
      replyWithHTML: jest.fn(),
      i18n: { t: jest.fn(() => 'Открой ссылку') },
    } as any;

    await scene.step1(ctx);

    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith('Открой ссылку', keyboard);
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
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      user: null,
      scene: { state: {}, leave: jest.fn() },
      tryAnswerCbQuery: jest.fn(),
    } as any;

    await expect(scene.step1(ctx)).rejects.toBeInstanceOf(UserException);
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });
});
