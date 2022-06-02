import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { YSTUtyService } from './ystuty.service';

@Global()
@Module({
    imports: [ScheduleModule.forRoot()],
    providers: [YSTUtyService],
    exports: [YSTUtyService],
})
export class YSTUtyModule {}
