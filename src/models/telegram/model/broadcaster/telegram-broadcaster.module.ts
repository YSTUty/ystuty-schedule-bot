import { Module } from '@nestjs/common';

import { BroadcastTelegramFeedbackUpdate } from './broadcast-telegram-feedback.update';
import { BroadcastTelegramRecipientActionUpdate } from './broadcast-telegram-recipient-action.update';
import { BroadcastTelegramUnsubscribeUpdate } from './broadcast-telegram-unsubscribe.update';
import { BroadcastTelegramUpdate } from './broadcast-telegram.update';
import { TelegramBroadcastScene } from './telegram-broadcast.scene';
import { TelegramBroadcastTransport } from './telegram-broadcast.transport';
import { TgBroadcastKeyboardFactory } from './tg-broadcast-keyboard.factory';

@Module({
  providers: [
    TgBroadcastKeyboardFactory,
    BroadcastTelegramUpdate,
    BroadcastTelegramFeedbackUpdate,
    BroadcastTelegramRecipientActionUpdate,
    BroadcastTelegramUnsubscribeUpdate,
    TelegramBroadcastScene,
    TelegramBroadcastTransport,
  ],
})
export class TelegramBroadcasterModule {}
