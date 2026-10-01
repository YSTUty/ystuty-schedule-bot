import * as http from 'node:http';
import { parse as parseQuery } from 'node:querystring';

import {
  closeHttpServer,
  listenHttpServer,
  sendJson,
} from './http-server.util';

type TelegramApiError = {
  error_code: number;
  description: string;
  parameters?: Record<string, unknown>;
};

export type FakeTelegramUser = {
  id: number;
  firstName?: string;
  username?: string;
};

export type FakeTelegramChat = {
  id: number;
  type: 'private' | 'group' | 'supergroup';
  title?: string;
  first_name?: string;
  username?: string;
};

export type FakeTelegramMessage = {
  message_id: number;
  date: number;
  chat: FakeTelegramChat;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  text?: string;
  entities?: {
    offset: number;
    length: number;
    type: 'bot_command';
  }[];
  reply_markup?: Record<string, unknown>;
};

export type FakeTelegramApiParams = Record<string, unknown>;

export type FakeTelegramApiCall<
  TMethod extends string = string,
  TParams extends FakeTelegramApiParams = FakeTelegramApiParams,
  TResult = unknown,
> = {
  method: TMethod;
  params: TParams;
  result: TResult;
};

type PendingPoll = {
  response: http.ServerResponse;
  offset: number;
};

type CallWaiter = {
  method: string;
  predicate: (call: FakeTelegramApiCall) => boolean;
  resolve: (call: FakeTelegramApiCall) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * Минимальный stateful Telegram Bot API для transport E2E.
 * Он не вызывает handlers напрямую: update попадает в очередь getUpdates,
 * поэтому проверяется настоящий polling Telegraf.
 */
export class FakeTelegramApi {
  private readonly server: http.Server;
  private readonly updates: Record<string, unknown>[] = [];
  private readonly pendingPolls = new Set<PendingPoll>();
  private readonly waiters = new Set<CallWaiter>();
  private readonly failures = new Map<string, TelegramApiError[]>();
  private readonly messages = new Map<string, FakeTelegramMessage>();
  /** Последний входящий чат нужен, чтобы ответ бота сохранял его реальный type. */
  private readonly chats = new Map<number, FakeTelegramChat>();
  private nextUpdateId = 1;
  private nextMessageId = 1;

  public readonly calls: FakeTelegramApiCall[] = [];
  public url = '';

  private constructor() {
    this.server = http.createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  public static async start() {
    const api = new FakeTelegramApi();
    api.url = await listenHttpServer(api.server);
    return api;
  }

  public async close() {
    for (const poll of this.pendingPolls) {
      poll.response.destroy();
    }
    this.pendingPolls.clear();

    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Fake Telegram API was closed'));
    }
    this.waiters.clear();
    await closeHttpServer(this.server);
  }

  public pushText(user: FakeTelegramUser, text: string) {
    const message = this.createUserMessage(user, text);
    this.pushUpdate({ message });
    return message;
  }

  /** Добавляет обычный message update из group/supergroup в настоящий polling. */
  public pushChatText(
    user: FakeTelegramUser,
    chat: Omit<FakeTelegramChat, 'first_name' | 'username'>,
    text: string,
  ) {
    if (chat.type === 'private') {
      throw new Error('pushChatText expects group or supergroup chat');
    }

    const message = this.createUserMessage(user, text, chat);
    this.pushUpdate({ message });
    return message;
  }

  public pushCallback(
    user: FakeTelegramUser,
    data: string,
    message: FakeTelegramMessage,
  ) {
    const callbackId = `e2e-callback-${this.nextUpdateId}`;
    this.pushUpdate({
      callback_query: {
        id: callbackId,
        from: this.createUser(user),
        message,
        chat_instance: `e2e-chat-${message.chat.id}`,
        data,
      },
    });
    return callbackId;
  }

  public failNext(method: string, error: TelegramApiError) {
    const failures = this.failures.get(method) || [];
    failures.push(error);
    this.failures.set(method, failures);
  }

  /**
   * Сбрасывает состояние одного test-case, не перезапуская настоящий polling.
   * Это остаётся частью fake Bot API проекта: в `nestjs-telega` позднее можно
   * вынести lifecycle/dispatch seam, но не неполную модель Telegram API.
   */
  public reset() {
    this.calls.splice(0);
    this.updates.splice(0);
    this.failures.clear();
    this.messages.clear();
    this.chats.clear();
  }

  public async waitForPolling(timeoutMs = 5e3) {
    await this.waitForCall('getUpdates', () => true, timeoutMs);
  }

  public async waitForCall<TCall extends FakeTelegramApiCall>(
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
            `Timed out waiting for Telegram ${method}; calls: ${this.calls
              .map(
                (call) =>
                  `${call.method}:${String(call.params.text || '').slice(0, 80)}`,
              )
              .join(', ')}; queued=[${this.updates
              .map((update) => update.update_id)
              .join(', ')}]; polls=[${[...this.pendingPolls]
              .map((poll) => `${poll.offset}:${poll.response.destroyed}`)
              .join(', ')}]`,
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

  /** Ожидает вызов, появившийся после конкретного действия тестового пользователя. */
  public async waitForNextCall<TCall extends FakeTelegramApiCall>(
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
            `Timed out waiting for new Telegram ${method}; calls after action: ${this.calls
              .slice(afterCallIndex)
              .map(
                (call) =>
                  `${call.method}:${String(call.params.text || '').slice(0, 100)}`,
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

  public getMessageWithCallback(data: string) {
    return [...this.messages.values()].find((message) =>
      this.messageHasCallback(message, data),
    );
  }

  private async handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ) {
    const method = request.url?.match(/^\/bot[^/]+\/(?<method>[^/?]+)/)?.groups
      ?.method;
    if (!method || request.method !== 'POST') {
      sendJson(
        response,
        { ok: false, description: 'Unknown fake Telegram route' },
        404,
      );
      return;
    }

    let params: Record<string, unknown>;
    try {
      params = await readTelegramParams(request);
    } catch {
      sendJson(
        response,
        { ok: false, description: 'Invalid Telegram request body' },
        400,
      );
      return;
    }

    const failure = this.failures.get(method)?.shift();
    if (failure) {
      this.recordCall(method, params, failure);
      sendJson(response, { ok: false, ...failure });
      return;
    }

    if (method === 'getUpdates') {
      this.recordCall(method, params, undefined);
      this.handleGetUpdates(request, response, Number(params.offset) || 0);
      return;
    }

    const result = this.handleMethod(method, params);
    this.recordCall(method, params, result);
    sendJson(response, { ok: true, result });
  }

  private handleGetUpdates(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    offset: number,
  ) {
    const poll = { response, offset };
    this.pendingPolls.add(poll);
    // A completed incoming request is normal for long polling. Only remove
    // this pending response when the client explicitly aborts the request.
    request.once('aborted', () => this.pendingPolls.delete(poll));
    this.flushPolls();
  }

  private handleMethod(method: string, params: Record<string, unknown>) {
    switch (method) {
      case 'getMe':
        return {
          id: 900001,
          is_bot: true,
          first_name: 'YSTUty E2E',
          username: 'ystuty_schedule_e2e_bot',
        };
      case 'sendMessage': {
        const message = this.createBotMessage(params);
        this.messages.set(
          this.messageKey(message.chat.id, message.message_id),
          message,
        );
        return message;
      }
      case 'editMessageText':
      case 'editMessageReplyMarkup': {
        const chatId = Number(params.chat_id);
        const messageId = Number(params.message_id);
        const key = this.messageKey(chatId, messageId);
        const existing =
          this.messages.get(key) ||
          this.createBotMessage({
            chat_id: chatId,
            message_id: messageId,
          });
        if (typeof params.text === 'string') existing.text = params.text;
        if (params.reply_markup && typeof params.reply_markup === 'object') {
          existing.reply_markup = params.reply_markup as Record<
            string,
            unknown
          >;
        }
        this.messages.set(key, existing);
        return existing;
      }
      case 'deleteMessage':
        this.messages.delete(
          this.messageKey(Number(params.chat_id), Number(params.message_id)),
        );
        return true;
      default:
        return true;
    }
  }

  private pushUpdate(update: Record<string, unknown>) {
    this.updates.push({ update_id: this.nextUpdateId++, ...update });
    this.flushPolls();
  }

  private flushPolls() {
    for (const poll of [...this.pendingPolls]) {
      const updates = this.updates.filter(
        (update) => Number(update.update_id) >= poll.offset,
      );
      if (updates.length === 0 || poll.response.destroyed) continue;

      this.pendingPolls.delete(poll);
      this.updates.splice(
        0,
        this.updates.findIndex((update) => update === updates.at(-1)) + 1,
      );
      sendJson(poll.response, { ok: true, result: updates });
    }
  }

  private createUserMessage(
    user: FakeTelegramUser,
    text: string,
    chat: Omit<FakeTelegramChat, 'first_name' | 'username'> = {
      id: user.id,
      type: 'private',
    },
  ): FakeTelegramMessage {
    const command = text.match(/^\/(?<name>[^\s@]+)/)?.[0];
    const resolvedChat: FakeTelegramChat =
      chat.type === 'private'
        ? {
            ...chat,
            first_name: user.firstName || 'E2E Student',
            username: user.username,
          }
        : chat;
    this.chats.set(resolvedChat.id, resolvedChat);

    return {
      message_id: this.nextMessageId++,
      date: Math.floor(Date.now() / 1e3),
      chat: resolvedChat,
      from: this.createUser(user),
      text,
      ...(command && {
        // Telegram marks typed /commands with a bot_command entity.
        entities: [{ offset: 0, length: command.length, type: 'bot_command' }],
      }),
    };
  }

  private createBotMessage(
    params: Record<string, unknown>,
  ): FakeTelegramMessage {
    const chatId = Number(params.chat_id);
    const messageId = Number(params.message_id) || this.nextMessageId++;
    const replyMarkup =
      params.reply_markup && typeof params.reply_markup === 'object'
        ? (params.reply_markup as Record<string, unknown>)
        : undefined;
    return {
      message_id: messageId,
      date: Math.floor(Date.now() / 1e3),
      chat: this.chats.get(chatId) || { id: chatId, type: 'private' },
      from: {
        id: 900001,
        is_bot: true,
        first_name: 'YSTUty E2E',
        username: 'ystuty_schedule_e2e_bot',
      },
      ...(typeof params.text === 'string' && { text: params.text }),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
  }

  private createUser(user: FakeTelegramUser) {
    return {
      id: user.id,
      is_bot: false,
      first_name: user.firstName || 'E2E Student',
      username: user.username,
    };
  }

  private messageHasCallback(message: FakeTelegramMessage, data: string) {
    const keyboard = message.reply_markup?.inline_keyboard;
    return (
      Array.isArray(keyboard) &&
      keyboard.some(
        (row) =>
          Array.isArray(row) &&
          row.some(
            (button) =>
              !!button &&
              typeof button === 'object' &&
              'callback_data' in button &&
              button.callback_data === data,
          ),
      )
    );
  }

  private messageKey(chatId: number, messageId: number) {
    return `${chatId}:${messageId}`;
  }

  private recordCall(
    method: string,
    params: Record<string, unknown>,
    result: unknown,
  ) {
    const call = { method, params, result } satisfies FakeTelegramApiCall;
    this.calls.push(call);
    for (const waiter of [...this.waiters]) {
      if (waiter.method !== method || !waiter.predicate(call)) continue;
      clearTimeout(waiter.timer);
      this.waiters.delete(waiter);
      waiter.resolve(call);
    }
  }
}

/**
 * Telegraf uses application/x-www-form-urlencoded for regular Bot API calls,
 * while JSON remains useful for manually authored fake-client requests.
 * Telegram encodes structured fields (such as reply_markup) as JSON strings.
 */
const readTelegramParams = async (request: http.IncomingMessage) => {
  const chunks: string[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk).toString('utf8'));
  }

  const body = chunks.join('');
  if (!body) return {};

  const contentType = String(request.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    return JSON.parse(body) as Record<string, unknown>;
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return normalizeTelegramStructuredParams(
      parseQuery(body) as Record<string, unknown>,
    );
  }
  if (contentType.includes('multipart/form-data')) {
    return normalizeTelegramStructuredParams(
      parseMultipartFields(body, contentType),
    );
  }
  throw new Error(`Unsupported content type: ${contentType || 'unknown'}`);
};

const normalizeTelegramStructuredParams = (params: Record<string, unknown>) => {
  for (const key of [
    'allowed_updates',
    'commands',
    'link_preview_options',
    'reply_markup',
    'reply_parameters',
    'scope',
  ]) {
    const value = params[key];
    if (typeof value !== 'string') continue;
    try {
      params[key] = JSON.parse(value);
    } catch {
      // Keep an invalid structured parameter raw: the fake API only needs
      // normalized valid objects to emulate outgoing messages and assertions.
    }
  }
  return params;
};

/**
 * A Bot API request with a media field uses Telegraf's multipart stream.
 * The E2E fake needs text fields only; file bytes are intentionally omitted.
 */
const parseMultipartFields = (body: string, contentType: string) => {
  const boundary = contentType.match(
    /boundary=(?:"(?<quoted>[^"]+)"|(?<plain>[^;\s]+))/,
  )?.groups;
  const value = boundary?.quoted || boundary?.plain;
  if (!value) throw new Error('Multipart boundary is missing');

  const fields: Record<string, unknown> = {};
  for (const part of body.split(`--${value}`)) {
    const [headerBlock, rawValue] = part.split('\r\n\r\n', 2);
    const name = headerBlock?.match(/name="(?<name>[^"]+)"/)?.groups?.name;
    if (!name || rawValue === undefined) continue;
    fields[name] = rawValue.replace(/\r\n$/, '');
  }
  return fields;
};
