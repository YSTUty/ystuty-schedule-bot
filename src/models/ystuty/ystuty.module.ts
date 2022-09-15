import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { YSTUtyService } from './ystuty.service';

@Global()
@Module({
    imports: [ScheduleModule.forRoot(), HttpModule.register({})],
    providers: [YSTUtyService],
    exports: [YSTUtyService],
})
export class YSTUtyModule {}
