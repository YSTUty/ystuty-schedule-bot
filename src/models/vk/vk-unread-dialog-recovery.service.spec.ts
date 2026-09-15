import { APIError, APIErrorCode } from 'vk-io';

import * as xEnv from '@my-environment';

import { VkUnreadDialogRecoveryService } from './vk-unread-dialog-recovery.service';

describe('VkUnreadDialogRecoveryService', () => {
  beforeEach(() => {
    // В CI нет локального .env, но recovery требует ID сообщества до вызова VK API.
    jest.replaceProperty(xEnv, 'SOCIAL_VK_GROUP_ID', 42);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createService = () => {
    const getConversations = jest.fn();
    const send = jest.fn().mockResolvedValue(1);
    const handleWebhookUpdate = jest.fn().mockResolvedValue(undefined);
    const redis = {
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const service = new VkUnreadDialogRecoveryService(
      {
        api: { messages: { getConversations, send } },
        updates: { handleWebhookUpdate },
      } as any,
      { redis } as any,
    );
    jest.spyOn((service as any).logger, 'log').mockImplementation();
    jest.spyOn((service as any).logger, 'warn').mockImplementation();
    const wait = jest.fn().mockResolvedValue(undefined);
    (service as any).wait = wait;

    return {
      getConversations,
      handleWebhookUpdate,
      redis,
      send,
      service,
      wait,
    };
  };

  it('notifies and replays a fresh unread direct message once after startup', async () => {
    const {
      getConversations,
      handleWebhookUpdate,
      redis,
      send,
      service,
      wait,
    } = createService();
    getConversations.mockResolvedValue({
      count: 1,
      items: [
        {
          conversation: { peer: { id: 123 } },
          last_message: {
            conversation_message_id: 12,
            date: 1_789_473_000,
            from_id: 123,
            id: 456,
            out: 0,
            peer_id: 123,
            text: 'Расписание',
          },
        },
      ],
    });

    await service.recoverUnreadDirectMessages(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(getConversations).toHaveBeenCalledWith({
      count: 200,
      filter: 'unread',
      group_id: expect.any(Number),
      offset: 0,
    });
    expect(redis.set).toHaveBeenCalledWith(
      'vk:unread-recovery:123:456',
      '1',
      'EX',
      432_000,
      'NX',
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ peer_id: 123 }),
    );
    expect(handleWebhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: expect.any(Number),
        object: expect.objectContaining({
          message: expect.objectContaining({ id: 456, text: 'Расписание' }),
        }),
        type: 'message_new',
      }),
    );
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  it('skips stale, outbound and payload messages', async () => {
    const { getConversations, handleWebhookUpdate, send, service } =
      createService();
    getConversations.mockResolvedValue({
      count: 3,
      items: [
        {
          conversation: { peer: { id: 1 } },
          last_message: {
            date: 1_789_041_000,
            from_id: 1,
            id: 1,
            out: 0,
            peer_id: 1,
            text: 'Старое сообщение',
          },
        },
        {
          conversation: { peer: { id: 2 } },
          last_message: {
            date: 1_789_473_000,
            from_id: -42,
            id: 2,
            out: 1,
            peer_id: 2,
            text: 'Ответ бота',
          },
        },
        {
          conversation: { peer: { id: 3 } },
          last_message: {
            date: 1_789_473_000,
            from_id: 3,
            id: 3,
            out: 0,
            payload: '{"phrase":"button.schedule.for_today"}',
            peer_id: 3,
            text: 'На сегодня',
          },
        },
      ],
    });

    await service.recoverUnreadDirectMessages(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(send).not.toHaveBeenCalled();
    expect(handleWebhookUpdate).not.toHaveBeenCalled();
  });

  it('does not replay a message already claimed by a previous startup', async () => {
    const { getConversations, handleWebhookUpdate, redis, send, service } =
      createService();
    redis.set.mockResolvedValue(null);
    getConversations.mockResolvedValue({
      count: 1,
      items: [
        {
          conversation: { peer: { id: 123 } },
          last_message: {
            date: 1_789_473_000,
            from_id: 123,
            id: 456,
            out: 0,
            peer_id: 123,
            text: 'Расписание',
          },
        },
      ],
    });

    await service.recoverUnreadDirectMessages(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(send).not.toHaveBeenCalled();
    expect(handleWebhookUpdate).not.toHaveBeenCalled();
  });

  it('waits and retries VK rate limits while reading unread dialogs', async () => {
    const { getConversations, service, wait } = createService();
    getConversations
      .mockRejectedValueOnce(
        new APIError({
          error_code: APIErrorCode.RATE_LIMIT,
          error_msg: 'Too many requests per second',
          request_params: [],
        }),
      )
      .mockResolvedValueOnce({ count: 0, items: [] });

    await service.recoverUnreadDirectMessages(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(getConversations).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  it('waits and retries VK rate limits while notifying a user', async () => {
    const { getConversations, handleWebhookUpdate, send, service, wait } =
      createService();
    getConversations.mockResolvedValue({
      count: 1,
      items: [
        {
          conversation: { peer: { id: 123 } },
          last_message: {
            date: 1_789_473_000,
            from_id: 123,
            id: 456,
            out: 0,
            peer_id: 123,
            text: 'Расписание',
          },
        },
      ],
    });
    send
      .mockRejectedValueOnce(
        new APIError({
          error_code: APIErrorCode.RATE_LIMIT,
          error_msg: 'Too many requests per second',
          request_params: [],
        }),
      )
      .mockResolvedValueOnce(1);

    await service.recoverUnreadDirectMessages(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(send).toHaveBeenCalledTimes(2);
    expect(handleWebhookUpdate).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenNthCalledWith(1, 1_000);
    expect(wait).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('releases the recovery claim after a transient notification error', async () => {
    const { getConversations, handleWebhookUpdate, redis, send, service } =
      createService();
    getConversations.mockResolvedValue({
      count: 1,
      items: [
        {
          conversation: { peer: { id: 123 } },
          last_message: {
            date: 1_789_473_000,
            from_id: 123,
            id: 456,
            out: 0,
            peer_id: 123,
            text: 'Расписание',
          },
        },
      ],
    });
    send.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    await service.recoverUnreadDirectMessages(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(redis.del).toHaveBeenCalledWith('vk:unread-recovery:123:456');
    expect(handleWebhookUpdate).not.toHaveBeenCalled();
  });

  it('replays an unavailable user message so middleware can persist the profile state', async () => {
    const { getConversations, handleWebhookUpdate, redis, send, service } =
      createService();
    getConversations.mockResolvedValue({
      count: 1,
      items: [
        {
          conversation: { peer: { id: 123 } },
          last_message: {
            date: 1_789_473_000,
            from_id: 123,
            id: 456,
            out: 0,
            peer_id: 123,
            text: 'Расписание',
          },
        },
      ],
    });
    send.mockRejectedValueOnce(
      new APIError({
        error_code: APIErrorCode.MESSAGES_USER_BLOCKED,
        error_msg: 'Bot was blocked by the user',
        request_params: [],
      }),
    );

    await service.recoverUnreadDirectMessages(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(handleWebhookUpdate).toHaveBeenCalledTimes(1);
    expect(redis.del).not.toHaveBeenCalled();
  });
});
