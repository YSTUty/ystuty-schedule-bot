import { Global, Module } from '@nestjs/common';

import { YSTUtyService } from './ystuty.service';

@Global()
@Module({
    imports: [],
    providers: [YSTUtyService],
    exports: [YSTUtyService],
})
export class YSTUtyModule {}
