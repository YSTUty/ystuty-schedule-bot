import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import * as xEnv from '@my-environment';

import { YSTUtyService } from './ystuty.service';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule.register({
      baseURL: xEnv.SCHEDULE_API_URL || xEnv.YSTUTY_PARSER_URL,
      timeout: 60e3,
      headers: {
        ...(xEnv.SCHEDULE_API_TOKEN && {
          Authorization: `Bearer ${xEnv.SCHEDULE_API_TOKEN}`,
        }),
      },
    }),
  ],
  providers: [YSTUtyService],
  exports: [YSTUtyService],
})
export class YSTUtyModule {}
