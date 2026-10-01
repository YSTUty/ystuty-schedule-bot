import * as http from 'node:http';
import { parse as parseQuery } from 'node:querystring';

import {
  closeHttpServer,
  listenHttpServer,
  sendJson,
} from './http-server.util';

type VkApiError = {
  error_code: number;
  error_msg: string;
  request_params?: { key: string; value: string }[];
};

export type FakeVkApiParams = Record<string, string | string[] | undefined>;

export type FakeVkApiCall<
  TMethod extends string = string,
  TParams extends FakeVkApiParams = FakeVkApiParams,
  TResult = unknown,
> = {
  method: TMethod;
  params: TParams;
  result: TResult;
};

type CallWaiter = {
  method: string;
  predicate: (call: FakeVkApiCall) => boolean;
  resolve: (call: FakeVkApiCall) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type PendingLongPoll = {
  response: http.ServerResponse;
};

/**
 * Минимальная модель VK method API и Bots Long Poll для транспортных E2E.
 * `groups.getLongPollServer` возвращает этот же сервер, поэтому vk-io делает
 * все API-вызовы и polling-запросы по настоящему HTTP-маршруту.
 */
export class FakeVkApi {
  private readonly server: http.Server;
  private readonly pendingLongPolls = new Set<PendingLongPoll>();
  private readonly updates: Record<string, unknown>[] = [];
  private readonly failures = new Map<string, VkApiError[]>();
  private readonly waiters = new Set<CallWaiter>();
  private longPollRequests = 0;
  private nextMessageId = 1;
  private nextTs = 1;

  public readonly calls: FakeVkApiCall[] = [];
  public url = '';

  private constructor(public readonly groupId = 900001) {
    this.server = http.createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  public static async start(groupId = 900001) {
    const api = new FakeVkApi(groupId);
    api.url = await listenHttpServer(api.server);
    return api;
  }

  public async close() {
    const polls = [...this.pendingLongPolls];
    for (const poll of polls) {
      // updates.stop() has already set vk-io polling to inactive. A normal
      // empty Long Poll response lets its current fetch finish without the
      // library's fixed 3-second network-error retry delay.
      sendJson(poll.response, { ts: String(++this.nextTs), updates: [] });
    }
    this.pendingLongPolls.clear();
    await Promise.all(polls.map((poll) => onceResponseFinished(poll.response)));
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Fake VK API was closed'));
    }
    this.waiters.clear();
    await closeHttpServer(this.server);
  }

  public pushMessage(userId: number, text: string, payload?: string) {
    this.pushMessageToPeer(userId, userId, text, payload);
  }

  /** Добавляет входящее сообщение из групповой беседы в настоящий Bots Long Poll. */
  public pushChatMessage(
    userId: number,
    conversationId: number,
    text: string,
    payload?: string,
  ) {
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      throw new Error('VK conversationId must be a positive safe integer');
    }

    this.pushMessageToPeer(userId, 2e9 + conversationId, text, payload);
  }

  /** Имитирует service update переименования беседы через message.action. */
  public pushChatTitleUpdate(
    userId: number,
    conversationId: number,
    title: string,
  ) {
    this.pushMessageToPeer(userId, 2e9 + conversationId, '', undefined, {
      type: 'chat_title_update',
      text: title,
    });
  }

  private pushMessageToPeer(
    userId: number,
    peerId: number,
    text: string,
    payload?: string,
    action?: Record<string, unknown>,
  ) {
    this.pushUpdate({
      type: 'message_new',
      object: {
        message: {
          date: Math.floor(Date.now() / 1e3),
          from_id: userId,
          id: this.nextMessageId++,
          out: 0,
          peer_id: peerId,
          conversation_message_id: this.nextMessageId,
          random_id: 0,
          important: false,
          is_hidden: false,
          attachments: [],
          fwd_messages: [],
          text,
          ...(payload && { payload }),
          ...(action && { action }),
        },
        client_info: {
          button_actions: ['text', 'vkpay', 'open_app', 'location', 'callback'],
          keyboard: true,
          inline_keyboard: true,
          carousel: false,
          lang_id: 0,
        },
      },
      group_id: this.groupId,
    });
  }

  /**
   * Имитирует разрешение личных сообщений сообществу. В production это
   * отдельный VK Bots Long Poll update без текста и peer_id.
   *
   * Это protocol fixture проекта. В `nestjs-vk` при будущем выносе может
   * понадобиться только typed raw-update dispatch, но не fake VK API.
   */
  public pushMessageAllow(userId: number) {
    this.pushUpdate({
      type: 'message_allow',
      object: { user_id: userId, key: `e2e-message-allow-${userId}` },
      group_id: this.groupId,
    });
  }

  /** Имитирует отзыв разрешения на личные сообщения сообществу. */
  public pushMessageDeny(userId: number) {
    this.pushUpdate({
      type: 'message_deny',
      object: { user_id: userId, key: `e2e-message-deny-${userId}` },
      group_id: this.groupId,
    });
  }

  public pushMessageEvent(
    userId: number,
    conversationMessageId: number,
    payload: Record<string, unknown>,
  ) {
    this.pushUpdate({
      type: 'message_event',
      object: {
        user_id: userId,
        peer_id: userId,
        conversation_message_id: conversationMessageId,
        event_id: `e2e-event-${this.nextMessageId++}`,
        payload,
      },
      group_id: this.groupId,
    });
  }

  public failNext(method: string, error: VkApiError) {
    const failures = this.failures.get(method) || [];
    failures.push(error);
    this.failures.set(method, failures);
  }

  /**
   * Сбрасывает только состояние тестового сценария, не разрывая настоящий
   * Bots Long Poll. Такой reset зависит от fake HTTP API конкретного проекта;
   * в `nestjs-vk` позднее может переехать лишь lifecycle/dispatch seam, но не
   * эта неполная реализация VK Method API.
   */
  public reset() {
    this.calls.splice(0);
    this.updates.splice(0);
    this.failures.clear();
  }

  public async waitForPolling(timeoutMs = 5e3) {
    await this.waitFor(() => this.longPollRequests > 0, timeoutMs);
  }

  public async waitForCall<TCall extends FakeVkApiCall>(
    method: TCall['method'],
    predicate: (call: TCall) => boolean = () => true,
    timeoutMs = 5e3,
  ): Promise<TCall> {
    const existing = this.calls.find(
      (call) => call.method === method && predicate(call as TCall),
    );
    if (existing) return existing as TCall;

    return await new Promise<TCall>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(
          new Error(
            `Timed out waiting for VK ${method}; calls: ${this.calls
              .map(
                (call) =>
                  `${call.method}(${JSON.stringify({
                    keys: Object.keys(call.params),
                    peer_id: call.params.peer_id,
                    hasKeyboard: !!call.params.keyboard,
                    message: String(call.params.message || '').slice(0, 80),
                  })})`,
              )
              .join(', ')}`,
          ),
        );
      }, timeoutMs);
      const waiter: CallWaiter = {
        method: String(method),
        predicate: (call) => predicate(call as TCall),
        resolve: (call) => resolve(call as TCall),
        reject,
        timer,
      };
      this.waiters.add(waiter);
    });
  }

  /** Ожидает API-вызов, созданный после определённого входящего события. */
  public async waitForNextCall<TCall extends FakeVkApiCall>(
    afterCallIndex: number,
    method: TCall['method'],
    predicate: (call: TCall) => boolean = () => true,
    timeoutMs = 5e3,
  ): Promise<TCall> {
    const existing = this.calls
      .slice(afterCallIndex)
      .find((call) => call.method === method && predicate(call as TCall));
    if (existing) return existing as TCall;

    return await new Promise<TCall>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(
          new Error(
            `Timed out waiting for new VK ${method}; calls after action: ${this.calls
              .slice(afterCallIndex)
              .map(
                (call) =>
                  `${call.method}:${String(call.params.message || '').slice(0, 80)}`,
              )
              .join(', ')}`,
          ),
        );
      }, timeoutMs);
      const waiter: CallWaiter = {
        method: String(method),
        predicate: (call) =>
          this.calls.indexOf(call) >= afterCallIndex &&
          predicate(call as TCall),
        resolve: (call) => resolve(call as TCall),
        reject,
        timer,
      };
      this.waiters.add(waiter);
    });
  }

  private async handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ) {
    const path = new URL(request.url || '/', 'http://e2e.local').pathname;
    if (request.method === 'GET' && path === '/longpoll') {
      this.handleLongPoll(request, response);
      return;
    }

    const method = path.match(/^\/method\/(?<method>[^/]+)$/)?.groups?.method;
    if (!method || request.method !== 'POST') {
      sendJson(response, { error: 'Unknown fake VK route' }, 404);
      return;
    }

    const params = await readFormBody(request);
    normalizeVkParams(params);
    const failure = this.failures.get(method)?.shift();
    if (failure) {
      const normalizedFailure: VkApiError = {
        request_params: [{ key: 'method', value: method }],
        ...failure,
      };
      this.recordCall(method, params, normalizedFailure);
      sendJson(response, { error: normalizedFailure });
      return;
    }

    const result = this.handleMethod(method, params);
    this.recordCall(method, params, result);
    sendJson(response, { response: result });
  }

  private handleLongPoll(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ) {
    this.longPollRequests += 1;
    const poll = { response };
    this.pendingLongPolls.add(poll);
    request.once('aborted', () => this.pendingLongPolls.delete(poll));
    this.flushLongPolls();
  }

  private handleMethod(method: string, _params: FakeVkApiParams) {
    switch (method) {
      case 'groups.getLongPollServer':
        return {
          key: 'e2e-long-poll-key',
          server: `${this.url}/longpoll`,
          ts: String(this.nextTs),
        };
      case 'messages.send':
        return this.nextMessageId++;
      case 'messages.getConversations':
        return { count: 0, items: [], unread_count: 0 };
      case 'messages.getConversationMembers':
        return { count: 1, items: [{ member_id: -this.groupId }] };
      default:
        return 1;
    }
  }

  private pushUpdate(update: Record<string, unknown>) {
    this.updates.push(update);
    this.flushLongPolls();
  }

  private flushLongPolls() {
    for (const poll of [...this.pendingLongPolls]) {
      if (this.updates.length === 0 || poll.response.destroyed) continue;

      this.pendingLongPolls.delete(poll);
      const updates = this.updates.splice(0);
      sendJson(poll.response, { ts: String(++this.nextTs), updates });
    }
  }

  private recordCall(method: string, params: FakeVkApiParams, result: unknown) {
    const call = { method, params, result } satisfies FakeVkApiCall;
    this.calls.push(call);
    for (const waiter of [...this.waiters]) {
      if (waiter.method !== method || !waiter.predicate(call)) continue;
      clearTimeout(waiter.timer);
      this.waiters.delete(waiter);
      waiter.resolve(call);
    }
  }

  private async waitFor(predicate: () => boolean, timeoutMs: number) {
    const startedAt = Date.now();
    while (!predicate()) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error('Timed out waiting for VK Bots Long Poll request');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

const readFormBody = async (request: http.IncomingMessage) => {
  const chunks: string[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk).toString('utf8'));
  }
  return parseQuery(chunks.join(''));
};

/** vk-io batches messages.send and serializes the single recipient as peer_ids. */
const normalizeVkParams = (params: FakeVkApiParams) => {
  if (params.peer_id || typeof params.peer_ids !== 'string') return;
  params.peer_id = params.peer_ids.split(',', 1)[0];
};

const onceResponseFinished = (response: http.ServerResponse) =>
  new Promise<void>((resolve) => {
    if (response.writableFinished || response.destroyed) {
      resolve();
      return;
    }
    response.once('finish', resolve);
    response.once('close', resolve);
  });
