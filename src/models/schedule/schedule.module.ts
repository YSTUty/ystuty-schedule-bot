import { Global, Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

import * as xEnv from '@my-environment';

import { ScheduleService } from './schedule.service';
import { TeacherListStateService } from './teacher-list-state.service';

@Global()
@Module({
  imports: [
    NestScheduleModule.forRoot(),
    HttpModule.register({
      baseURL: xEnv.SCHEDULE_API_URL,
      timeout: 60e3,
      headers: {
        ...(xEnv.SCHEDULE_API_TOKEN && {
          Authorization: `Bearer ${xEnv.SCHEDULE_API_TOKEN}`,
        }),
      },
    }),
  ],
  providers: [ScheduleService, TeacherListStateService],
  exports: [ScheduleService, TeacherListStateService],
})
export class ScheduleModule {}
