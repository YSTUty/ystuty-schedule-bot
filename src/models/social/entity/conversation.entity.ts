import { Expose, plainToClass } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SocialType } from '@my-common/constants';

import { UserSocial } from '../../user/entity/user-social.entity';

import { UserToConversation } from './userToConversation.entity';

@Entity()
@Index(['social', 'conversationId'], { unique: true })
export class Conversation {
  @Expose()
  @PrimaryGeneratedColumn()
  public id: number;

  @Expose()
  @Column({ type: 'enum', enum: SocialType })
  public social: SocialType;

  @Expose()
  @Column({
    type: 'bigint',
    transformer: [
      {
        to: (entityValue: bigint) => entityValue,
        from: (databaseValue: string): bigint => BigInt(databaseValue),
      },
    ],
  })
  public conversationId: number | bigint;

  @Expose()
  @Column({ type: 'character varying', nullable: true })
  public title?: string | null;

  @Column({ type: 'boolean', default: false })
  public isLeaved: boolean;

  @Expose()
  @Column({ type: 'character varying', length: 16, nullable: true })
  public groupName?: string | null;

  @Expose()
  @ManyToOne(() => UserSocial, { nullable: true })
  @JoinColumn()
  public invitedByUserSocial?: UserSocial | null;

  @Expose()
  @Column({ nullable: true })
  public invitedByUserSocialId: number | null;

  @Expose()
  @Column({ type: 'character varying', length: 64, nullable: true })
  public chatStatus: string | null;

  @Expose()
  @Column({ type: 'character varying', length: 64, nullable: true })
  public chatType: string | null;

  @OneToMany(() => UserToConversation, (membership) => membership.conversation)
  public userMemberships: UserToConversation[];

  @Expose()
  @CreateDateColumn()
  public createdAt: Date;

  @Expose()
  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(input?: Partial<Conversation>) {
    if (input) {
      Object.assign(this, plainToClass(Conversation, input));
    }
  }
}
