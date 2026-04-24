import { SetMetadata } from '@nestjs/common';

export const TG_ALLOWED_CHAT_TYPES_KEY = 'TG_ALLOWED_CHAT_TYPES_KEY';

export type TelegrafChatType =
  | 'any'
  | 'group'
  | 'supergroup'
  | 'channel'
  | 'private';

/**
 * [Telegraf] Allowed chat types
 */
export const AllowedChatTypes = (...allowed: TelegrafChatType[]) =>
  SetMetadata(TG_ALLOWED_CHAT_TYPES_KEY, allowed);
