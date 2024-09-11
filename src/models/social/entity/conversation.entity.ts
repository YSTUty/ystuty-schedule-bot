import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Expose, plainToClass } from 'class-transformer';
import { UserSocial } from 'src/models/user/entity/user-social.entity';
import { SocialType } from '@my-common';

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
  public conversationId: number;

  @Expose()
  @Column({ type: 'character varying', nullable: true })
  public title?: string;

  @Column({ type: 'boolean', default: false })
  public isLeaved: boolean;

  @Expose()
  @Column({ type: 'character varying', length: 16, nullable: true })
  public groupName?: string;

  @Expose()
  @ManyToOne(() => UserSocial /* , (userSocial) => userSocial.conversations */)
  @JoinColumn()
  public invitedByUserSocial?: UserSocial;

  @Expose()
  @Column({ nullable: true })
  public invitedByUserSocialId: number;

  @Expose()
  @ManyToMany(() => UserSocial, (userSocial) => userSocial.conversations)
  @JoinTable({
    name: 'user_to_conversation',
    joinColumn: { name: 'conversationId' },
    inverseJoinColumn: { name: 'userSocialId' },
  })
  public users: UserSocial[];

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
