import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Expose, plainToClass } from 'class-transformer';

import { UserSocial } from '../../user/entity/user-social.entity';
import { Conversation } from './conversation.entity';

@Entity({ name: 'user_to_conversation' })
@Index(['conversationId', 'userSocialId'], { unique: true })
export class UserToConversation {
  @Expose()
  @PrimaryColumn()
  public conversationId: number;

  @Expose()
  @ManyToOne(() => Conversation, (conversation) => conversation.users)
  @JoinColumn({ name: 'conversationId' })
  public conversations: Conversation[];

  @Expose()
  @PrimaryColumn()
  public userSocialId: number;

  @Expose()
  @ManyToOne(() => UserSocial, (userSocial) => userSocial.conversations)
  @JoinColumn({ name: 'userSocialId' })
  public userSocials: UserSocial[];

  constructor(input?: Partial<UserToConversation>) {
    if (input) {
      Object.assign(this, plainToClass(UserToConversation, input));
    }
  }
}
