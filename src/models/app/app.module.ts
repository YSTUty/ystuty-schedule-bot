import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { YSTUtyModule } from '../ystuty/ystuty.module';
import { VkModule } from '../vk/vk.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
    imports: [YSTUtyModule, VkModule.register(), TelegramModule.register()],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
