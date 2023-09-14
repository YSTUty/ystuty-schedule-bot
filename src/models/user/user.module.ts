import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from './user.service';
import { User } from './entity/user.entity';
import { UserSocial } from './entity/user-social.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserSocial])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
