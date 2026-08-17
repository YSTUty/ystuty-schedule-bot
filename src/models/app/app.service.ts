import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { TelegramService } from '../telegram/telegram.service';
import { VkService } from '../vk/vk.service';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly telegramService: TelegramService,
    private readonly vkService: VkService,
  ) {}

  onModuleInit() {
    this.logMessengerStatuses();
    this.checkVersion().catch(console.error);
  }

  private logMessengerStatuses() {
    this.logger.debug(
      'MessengerServices:',
      JSON.stringify(
        {
          telegram: this.telegramService.isActive,
          vk: this.vkService.isActive,
        },
        null,
        1,
      ),
    );
  }

  async checkVersion() {
    const curVer = process.env.npm_package_version!;
    const lastVer =
      (await this.redisService.redis.get('app:last-version')) || '0.0.0';

    if (lastVer !== curVer) {
      await this.redisService.redis.set('app:last-version', curVer);
      if (lastVer && this.telegramService.isActive) {
        await this.telegramService.notifyAdmin(
          `✨ Bot updated from <code>v${lastVer}</code> to <code>v${curVer}</code>`,
        );
      }
    }
  }
}
