import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MetricsModule } from '../metrics/metrics.module';
import { YSTUtyModule } from '../ystuty/ystuty.module';
import { RedisModule } from '../redis/redis.module';
import { VkModule } from '../vk/vk.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UserModule } from '../user/user.module';
import { SocialConnectModule } from '../social-connect/social-connect.module';

@Module({
  imports: [
    SocialConnectModule,
    MetricsModule.forRoot(),
    YSTUtyModule,
    RedisModule,
    VkModule.register(),
    TelegramModule.register(),
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
