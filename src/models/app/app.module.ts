import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { VkModule } from '../vk/vk.module';
import { YSTUtyModule } from '../ystuty/ystuty.module';

@Module({
    imports: [VkModule, YSTUtyModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
