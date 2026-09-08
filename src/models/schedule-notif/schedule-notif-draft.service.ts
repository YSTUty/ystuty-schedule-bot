import { Injectable, Logger } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { SocialType } from '@my-common/constants';

import { RedisService } from '../redis/redis.service';

import { ScheduleNotifSettings } from './schedule-notif.types';

export type ScheduleNotifDraftContext = {
  transport: SocialType;
  ownerId: number;
  peerId: number;
};

export type ScheduleNotifDraft = ScheduleNotifDraftContext & {
  userSocialId: number;
  settings: ScheduleNotifSettings;
};

/**
 * Хранит короткоживущие параметры новой рассылки между выбором времени и цели.
 * Они не попадают в transport session, поэтому не конфликтуют с другими
 * сценариями пользователя.
 */
@Injectable()
export class ScheduleNotifDraftService {
  private readonly logger = new Logger(ScheduleNotifDraftService.name);
  private readonly keyPrefix = 'ystuty:schedule-notif-draft:';
  private readonly ttlSeconds = 15 * 60;

  constructor(private readonly redisService: RedisService) {}

  public async create(draft: ScheduleNotifDraft) {
    const id = randomUUID().replaceAll('-', '').slice(0, 12);
    await this.redisService.redis.set(
      this.getKey(id),
      JSON.stringify(draft),
      'EX',
      this.ttlSeconds,
    );
    return id;
  }

  public async get(
    id: string,
    context: ScheduleNotifDraftContext,
  ): Promise<ScheduleNotifDraft | null> {
    const key = this.getKey(id);
    const rawDraft = await this.redisService.redis.get(key);
    if (!rawDraft) return null;

    try {
      const draft = JSON.parse(rawDraft) as ScheduleNotifDraft;
      const belongsToContext =
        draft.transport === context.transport &&
        draft.ownerId === context.ownerId &&
        draft.peerId === context.peerId;
      return belongsToContext ? draft : null;
    } catch {
      this.logger.warn(`Invalid schedule notification draft: ${id}`);
      await this.redisService.redis.del(key);
      return null;
    }
  }

  public async consume(id: string, context: ScheduleNotifDraftContext) {
    const draft = await this.get(id, context);
    if (draft) {
      await this.redisService.redis.del(this.getKey(id));
    }
    return draft;
  }

  private getKey(id: string) {
    return `${this.keyPrefix}${id}`;
  }
}
