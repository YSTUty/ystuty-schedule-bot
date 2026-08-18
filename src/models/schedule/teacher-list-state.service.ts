import { Injectable, Logger } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { RedisService } from '../redis/redis.service';

export type TeacherListTransport = 'telegram' | 'vkontakte';

export interface TeacherListState {
  transport: TeacherListTransport;
  ownerId: number;
  peerId: number;
  query: string;
  pageSize: number;
}

@Injectable()
export class TeacherListStateService {
  private readonly logger = new Logger(TeacherListStateService.name);
  private readonly keyPrefix = 'ystuty:teacher-list:';
  private readonly ttlSeconds = 30 * 60;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Создаёт краткоживущее состояние одного сообщения со списком преподавателей.
   * Callback передаёт только listId и номер страницы, поэтому поиск из другого
   * сообщения не может повлиять на этот список.
   */
  public async create(params: TeacherListState): Promise<string> {
    const listId = randomUUID().replaceAll('-', '').slice(0, 12);
    await this.redisService.redis.set(
      this.getKey(listId),
      JSON.stringify(params),
      'EX',
      this.ttlSeconds,
    );
    return listId;
  }

  /**
   * Возвращает состояние списка, если callback принадлежит его создателю.
   * Несовпадение transport, пользователя или диалога считается недействительным
   * состоянием, чтобы кнопка из чужого сообщения не меняла список.
   */
  public async get(
    listId: string,
    context: Pick<TeacherListState, 'transport' | 'ownerId' | 'peerId'>,
  ): Promise<TeacherListState | null> {
    const key = this.getKey(listId);
    const rawState = await this.redisService.redis.get(key);
    if (!rawState) return null;

    try {
      const state = JSON.parse(rawState) as TeacherListState;
      const isOwner =
        state.transport === context.transport &&
        state.ownerId === context.ownerId &&
        state.peerId === context.peerId;

      return isOwner ? state : null;
    } catch {
      this.logger.warn(`Invalid teacher list state: ${listId}`);
      await this.redisService.redis.del(key);
      return null;
    }
  }

  private getKey(listId: string) {
    return `${this.keyPrefix}${listId}`;
  }
}
