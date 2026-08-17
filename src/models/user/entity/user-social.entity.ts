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

import { UserToConversation } from '../../social/entity/userToConversation.entity';

import { User } from './user.entity';

@Entity()
@Index(['social', 'socialId'], { unique: true })
export class UserSocial {
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
        // TODO!: fix(db): replace BigInt transformers with numeric casting
        from: (databaseValue: string): bigint => BigInt(databaseValue),
        // from: (databaseValue: string) => Number(databaseValue),
      },
    ],
  })
  public socialId: number;

  @Expose()
  @Column({ type: 'character varying', length: 32, nullable: true })
  public username: string | null;

  @Expose()
  @Column({ type: 'character varying', length: 64, nullable: true })
  public displayname: string | null;

  @Expose()
  @Column({ type: 'character varying', length: 120, nullable: true })
  public profileUrl: string | null;

  @Expose()
  @Column({ type: 'character varying', nullable: true })
  public avatarUrl: string | null;

  @Expose()
  @Column({ type: 'character varying', length: 16, nullable: true })
  public groupName?: string | null;

  @Column({ type: 'boolean', default: false })
  public isBlockedBot: boolean;

  /** Has DM, otherwise received from chat */
  @Column({ type: 'boolean', default: false })
  public hasDM: boolean;

  @Expose()
  @ManyToOne(() => User, (user) => user.socials, { nullable: true })
  @JoinColumn()
  public user?: User | null;

  @Expose()
  @Column({ nullable: true })
  public userId: number | null;

  @OneToMany(() => UserToConversation, (membership) => membership.userSocial)
  public conversationMemberships: UserToConversation[];

  @Expose()
  @CreateDateColumn()
  public createdAt: Date;

  @Expose()
  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(input?: Partial<UserSocial>) {
    if (input) {
      Object.assign(this, plainToClass(UserSocial, input));
    }
  }
}
