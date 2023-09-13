import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

import * as xEnv from '@my-environment';

import { SocialConnectService } from './social-connect.service';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule.register({
      baseURL: xEnv.SOCAIL_CONNECT_URI,
      timeout: 5e3,
    }),
  ],
  providers: [SocialConnectService],
  exports: [SocialConnectService],
})
export class SocialConnectModule {}
