import {
    Injectable,
    Logger,
    OnModuleInit,
    OnApplicationShutdown,
} from '@nestjs/common';
import { InjectBot } from '@xtcry/nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { SOCIAL_TELEGRAM_ADMIN_IDS } from '@my-environment';

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(TelegramService.name);

    constructor(@InjectBot() public readonly bot: Telegraf) {}

    async onModuleInit() {
        await this.launch();
    }

    async onApplicationShutdown(signal: string) {
        await this.shutdown(signal);
    }

    public async sendMessage(
        chatId: number,
        text: string,
        extra: ExtraReplyMessage = {},
    ) {
        try {
            return await this.bot.telegram.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                ...extra,
            });
        } catch (err) {}
    }

    public async launch() {
        this.bot.catch((err: Error, ctx) => {
            this.logger.error(`${ctx?.updateType}: ${err}`, err.stack);
        });

        try {
            await this.bot.telegram.setMyCommands([
                { command: 'start', description: 'Start the bot' },
                { command: 'day', description: 'Расписание на день' },
                { command: 'week', description: 'Расписание на неделю' },
            ]);
            await this.bot.launch();
            this.logger.log('[Bot] Started');
            await this.notifyAdmin('🚀 BotServer is running');
        } catch (err) {
            this.logger.error(err);
        }
    }

    public async notifyAdmin(message: string, extra: ExtraReplyMessage = {}) {
        const adminIds = SOCIAL_TELEGRAM_ADMIN_IDS;
        // TODO: FIX BIG SPAM
        for (const uid of adminIds) {
            await this.sendMessage(uid, message, {
                disable_notification: true,
                ...extra,
            });
        }
    }

    public async shutdown(signal: string) {
        await this.notifyAdmin(`⚠️ BotServer shutdown [${signal}]`);
    }
}
