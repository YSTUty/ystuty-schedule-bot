import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SocialService } from './social.service';

import { Conversation } from './entity/conversation.entity';
import { UserToConversation } from './entity/userToConversation.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Conversation, UserToConversation])],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
