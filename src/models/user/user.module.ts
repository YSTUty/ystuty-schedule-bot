import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserSocial } from './entity/user-social.entity';
import { User } from './entity/user.entity';
import { UserService } from './user.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserSocial])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
