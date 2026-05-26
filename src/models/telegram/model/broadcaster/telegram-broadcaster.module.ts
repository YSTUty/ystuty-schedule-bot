import { Module } from '@nestjs/common';

import { BroadcastTelegramUpdate } from './broadcast-telegram.update';
import { TelegramBroadcastScene } from './telegram-broadcast.scene';
import { TelegramBroadcastTransport } from './telegram-broadcast.transport';

@Module({
  providers: [
    BroadcastTelegramUpdate,
    TelegramBroadcastScene,
    TelegramBroadcastTransport,
  ],
})
export class TelegramBroadcasterModule {}
