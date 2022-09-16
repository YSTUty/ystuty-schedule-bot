import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AppService {
    constructor(
        private readonly redisService: RedisService,
        private readonly telegramService: TelegramService,
    ) {}

    onModuleInit() {
        this.checkVersion().catch(console.error);
    }

    getHello(): string {
        return 'Hello World!';
    }

    async checkVersion() {
        const curVer = process.env.npm_package_version;
        const lastVer =
            (await this.redisService.redis.get('app:last-version')) || '0.0.0';

        if (lastVer !== curVer) {
            await this.redisService.redis.set('app:last-version', curVer);
            if (lastVer) {
                this.telegramService.notifyAdmin(
                    `✨ Bot updated from <code>v${lastVer}</code> to <code>v${curVer}</code>`,
                );
            }
        }
    }
}
