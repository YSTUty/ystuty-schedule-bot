import { Module } from '@nestjs/common';

import { BroadcastTelegramFeedbackUpdate } from './broadcast-telegram-feedback.update';
import { BroadcastTelegramUpdate } from './broadcast-telegram.update';
import { TelegramBroadcastScene } from './telegram-broadcast.scene';
import { TelegramBroadcastTransport } from './telegram-broadcast.transport';

@Module({
  providers: [
    BroadcastTelegramUpdate,
    BroadcastTelegramFeedbackUpdate,
    TelegramBroadcastScene,
    TelegramBroadcastTransport,
  ],
})
export class TelegramBroadcasterModule {}
