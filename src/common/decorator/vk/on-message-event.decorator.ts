import { applyDecorators } from '@nestjs/common';
import { On } from 'nestjs-vk';

import { AdminGuardNext } from './admin-guard-next.decorator';

/**
 * Регистрирует обработчик inline-callback VK и разрешает пропустить его
 * не-администратору к следующему обработчику той же middleware-цепочки.
 */
export const OnMessageEvent = () =>
  applyDecorators(On('message_event'), AdminGuardNext());
