import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import * as xEnv from '@my-environment';
import { RolesGuard } from '@my-common/guard/roles.guard';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MetricsModule } from '../metrics/metrics.module';
import { YSTUtyModule } from '../ystuty/ystuty.module';
import { RedisModule } from '../redis/redis.module';
import { VkModule } from '../vk/vk.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UserModule } from '../user/user.module';
import { SocialConnectModule } from '../social-connect/social-connect.module';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => ({
        ...xEnv.TYPEORM_CONFIG,

        type: 'postgres' as const,

        autoLoadEntities: true,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
      }),
    }),
    SocialConnectModule,
    SocialModule,
    MetricsModule.forRoot(),
    YSTUtyModule,
    RedisModule,
    VkModule.register(),
    TelegramModule.register(),
    UserModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }, AppService],
})
export class AppModule {}
