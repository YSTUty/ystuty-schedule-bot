import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MetricsModule } from '../metrics/metrics.module';
import { YSTUtyModule } from '../ystuty/ystuty.module';
import { RedisModule } from '../redis/redis.module';
import { VkModule } from '../vk/vk.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    MetricsModule.forRoot(),
    YSTUtyModule,
    RedisModule,
    VkModule.register(),
    TelegramModule.register(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
