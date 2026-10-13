import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  it('aborts a stalled outgoing message instead of blocking a notification worker indefinitely', async () => {
    const callApi = jest.fn().mockResolvedValue({ message_id: 42 });
    const bot = { telegram: { callApi } };
    const service = new TelegramService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'isActive', 'get').mockReturnValue(true);

    await expect(service.sendMessage(123, 'Hello')).resolves.toEqual({
      message_id: 42,
    });

    expect(callApi).toHaveBeenCalledWith(
      'sendMessage',
      { chat_id: 123, text: 'Hello', parse_mode: 'HTML' },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('does not send an outgoing message when Telegram is inactive', async () => {
    const callApi = jest.fn();
    const service = new TelegramService(
      { telegram: { callApi } } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'isActive', 'get').mockReturnValue(false);

    await expect(service.sendMessage(123, 'Hello')).resolves.toBe(false);
    expect(callApi).not.toHaveBeenCalled();
  });

  it('preserves an outgoing API error for background delivery retries', async () => {
    const error = new Error('429: retry after 3');
    const callApi = jest.fn().mockRejectedValue(error);
    const service = new TelegramService(
      { telegram: { callApi } } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'isActive', 'get').mockReturnValue(true);

    await expect(service.sendMessageOrThrow(123, 'Hello')).rejects.toBe(error);
  });

  it('enables polling conflict retry on launch', async () => {
    const bot = {
      catch: jest.fn(),
      launch: jest.fn(() => new Promise<void>(() => undefined)),
      telegram: { setMyCommands: jest.fn().mockResolvedValue(true) },
    };
    const service = new TelegramService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'notifyAdmin').mockResolvedValue(false);

    await service.launch();

    expect(bot.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        polling: { retryOnConflict: true },
      }),
    );
  });

  it('restarts polling after a proxy returns an HTML error page', async () => {
    jest.useFakeTimers();

    try {
      const proxyError = new SyntaxError(
        'Unexpected token \'<\', "<html>" is not valid JSON',
      );
      const bot = {
        catch: jest.fn(),
        launch: jest
          .fn()
          .mockRejectedValueOnce(proxyError)
          .mockImplementationOnce(() => new Promise<void>(() => undefined)),
        telegram: { setMyCommands: jest.fn().mockResolvedValue(true) },
      };
      const service = new TelegramService(
        bot as any,
        {} as any,
        {} as any,
        {} as any,
      );
      jest.spyOn(service, 'notifyAdmin').mockResolvedValue(false);
      const loggerError = jest.spyOn((service as any).logger, 'error');

      await service.launch();
      await Promise.resolve();

      expect(loggerError).toHaveBeenCalledWith(
        '[Bot] Polling stopped unexpectedly; scheduling reconnect',
        proxyError.stack,
      );
      expect(bot.launch).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(5e3);

      expect(bot.launch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels a pending polling reconnect during shutdown', async () => {
    jest.useFakeTimers();

    try {
      const bot = {
        catch: jest.fn(),
        launch: jest.fn().mockRejectedValue(new Error('Proxy unavailable')),
        telegram: { setMyCommands: jest.fn().mockResolvedValue(true) },
      };
      const service = new TelegramService(
        bot as any,
        {} as any,
        {} as any,
        {} as any,
      );
      jest.spyOn(service, 'notifyAdmin').mockResolvedValue(false);

      await service.launch();
      await Promise.resolve();
      await service.shutdown('SIGTERM');
      await jest.advanceTimersByTimeAsync(5e3);

      expect(bot.launch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry polling when Telegram rejects the bot token', async () => {
    jest.useFakeTimers();

    try {
      const bot = {
        catch: jest.fn(),
        launch: jest.fn().mockRejectedValue({ code: 401 }),
        telegram: { setMyCommands: jest.fn().mockResolvedValue(true) },
      };
      const service = new TelegramService(
        bot as any,
        {} as any,
        {} as any,
        {} as any,
      );
      jest.spyOn(service, 'notifyAdmin').mockResolvedValue(false);

      await service.launch();
      await jest.advanceTimersByTimeAsync(5e3);

      expect(bot.launch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('sets an authorization command for an unauthorized private-chat user', async () => {
    const bot = {
      telegram: { setMyCommands: jest.fn().mockResolvedValue(true) },
    };
    const service = new TelegramService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.syncPrivateChatCommands({
      chatId: 123,
      isAuthorized: false,
      isAdmin: false,
    });

    expect(bot.telegram.setMyCommands).toHaveBeenCalledWith(
      [
        { command: 'start', description: 'Запустить бота' },
        { command: 'day', description: 'Расписание на день' },
        {
          command: 'calendar',
          description: 'Добавить расписание в календарь',
        },
        { command: 'feedback', description: 'Оставить обратную связь' },
        { command: 'cancel', description: 'Отменить текущее действие' },
        { command: 'auth', description: 'Авторизоваться' },
        {
          command: 'institutes',
          description: 'Выбрать группу по институту',
        },
        {
          command: 'tlist',
          description: 'Выбрать преподавателя из списка',
        },
        { command: 'teacher', description: 'Выбрать преподавателя по ФИО' },
      ],
      { scope: { type: 'chat', chat_id: 123 } },
    );
  });

  it('sets schedule and teacher commands only when they are available', async () => {
    const bot = {
      telegram: { setMyCommands: jest.fn().mockResolvedValue(true) },
    };
    const service = new TelegramService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.syncPrivateChatCommands({
      chatId: 123,
      isAuthorized: true,
      isAdmin: false,
      hasGroup: true,
      teacherId: 456,
    });

    expect(bot.telegram.setMyCommands).toHaveBeenCalledWith(
      [
        { command: 'start', description: 'Запустить бота' },
        { command: 'day', description: 'Расписание на день' },
        {
          command: 'calendar',
          description: 'Добавить расписание в календарь',
        },
        { command: 'feedback', description: 'Оставить обратную связь' },
        { command: 'cancel', description: 'Отменить текущее действие' },
        { command: 'week', description: 'Расписание на неделю' },
        { command: 'tday', description: 'Расписание преподавателя на сегодня' },
        { command: 'tweek', description: 'Расписание преподавателя на неделю' },
        {
          command: 'institutes',
          description: 'Выбрать группу по институту',
        },
        {
          command: 'tlist',
          description: 'Выбрать преподавателя из списка',
        },
        { command: 'teacher', description: 'Выбрать преподавателя по ФИО' },
      ],
      { scope: { type: 'chat', chat_id: 123 } },
    );
  });

  it('adds the broadcast command only after the standard private-chat menu', async () => {
    const bot = {
      telegram: { setMyCommands: jest.fn().mockResolvedValue(true) },
    };
    const service = new TelegramService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.syncPrivateChatCommands({
      chatId: 123,
      isAuthorized: true,
      isAdmin: true,
    });

    expect(bot.telegram.setMyCommands).toHaveBeenCalledWith(
      [
        { command: 'start', description: 'Запустить бота' },
        { command: 'day', description: 'Расписание на день' },
        {
          command: 'calendar',
          description: 'Добавить расписание в календарь',
        },
        { command: 'feedback', description: 'Оставить обратную связь' },
        { command: 'cancel', description: 'Отменить текущее действие' },
        {
          command: 'institutes',
          description: 'Выбрать группу по институту',
        },
        {
          command: 'tlist',
          description: 'Выбрать преподавателя из списка',
        },
        { command: 'teacher', description: 'Выбрать преподавателя по ФИО' },
        { command: 'broadcast', description: 'Управление рассылками' },
      ],
      { scope: { type: 'chat', chat_id: 123 } },
    );
  });

  it('does not fail the update flow when Telegram rejects a menu update', async () => {
    const bot = {
      telegram: {
        setMyCommands: jest.fn().mockRejectedValue(new Error('403')),
      },
    };
    const service = new TelegramService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.syncPrivateChatCommands({
        chatId: 123,
        isAuthorized: false,
        isAdmin: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('caches chat administrators for two minutes', async () => {
    const admins = [{ user: { id: 1 }, status: 'administrator' }];
    const bot = {
      telegram: {
        getChatAdministrators: jest.fn().mockResolvedValue(admins),
      },
    };
    const redisService = {
      redis: {
        get: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(JSON.stringify(admins)),
        set: jest.fn(),
      },
    };
    const service = new TelegramService(
      bot as any,
      {} as any,
      redisService as any,
      {} as any,
    );

    await expect(service.getCachedChatAdmins(123)).resolves.toEqual(admins);
    await expect(service.getCachedChatAdmins(123)).resolves.toEqual(admins);

    expect(bot.telegram.getChatAdministrators).toHaveBeenCalledTimes(1);
    expect(redisService.redis.set).toHaveBeenCalledWith(
      'telegram:chat-admins:123',
      JSON.stringify([{ user: { id: 1 }, status: 'administrator' }]),
      'EX',
      120,
    );
  });

  it('reads the bot membership directly from Telegram', async () => {
    const bot = {
      botInfo: { id: 42 },
      telegram: {
        getChatMember: jest.fn().mockResolvedValue({ status: 'administrator' }),
      },
    };
    const service = new TelegramService(
      bot as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getBotChatMembership(-1001)).resolves.toEqual({
      isLeaved: false,
      chatStatus: 'administrator',
    });

    expect(bot.telegram.getChatMember).toHaveBeenCalledWith(-1001, 42);
  });
});
