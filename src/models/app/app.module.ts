import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import * as xEnv from '@my-environment';

import { RolesGuard } from '@my-common/guard/roles.guard';

import { BroadcastModule } from '../broadcast/broadcast.module';
import { ConcurrencyModule } from '../concurrency/concurrency.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { MetricsModule } from '../metrics/metrics.module';
import { RedisModule } from '../redis/redis.module';
import { ScheduleNotifModule } from '../schedule-notif/schedule-notif.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { SocialConnectModule } from '../social-connect/social-connect.module';
import { SocialModule } from '../social/social.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UserModule } from '../user/user.module';
import { VkModule } from '../vk/vk.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: async () => ({
        ...xEnv.TYPEORM_CONFIG,

        type: 'postgres' as const,

        autoLoadEntities: true,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
      }),
    }),
    BullModule.forRoot({
      redis: {
        host: xEnv.REDIS_HOST,
        port: xEnv.REDIS_PORT,
        db: xEnv.REDIS_DATABASE,
        password: xEnv.REDIS_PASSWORD,
      },
      prefix: `${xEnv.REDIS_PREFIX}bull`,
    }),
    ConcurrencyModule,
    FeedbackModule,
    SocialConnectModule,
    SocialModule,
    BroadcastModule,
    ScheduleNotifModule,
    MetricsModule.forRoot(),
    ScheduleModule,
    RedisModule,
    VkModule.register(),
    TelegramModule.register(),
    UserModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }, AppService],
})
export class AppModule {}
