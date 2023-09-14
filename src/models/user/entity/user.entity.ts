import { Exclude, Expose, plainToClass } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '@my-common';
import { UserSocial } from './user-social.entity';

@Entity()
@Exclude()
export class User {
  @Expose()
  @PrimaryGeneratedColumn()
  public id: number;

  @Expose()
  @Column({ type: 'integer' })
  public externalId: number;

  @Expose()
  @Column({ type: 'character varying' })
  public fullname: string;

  @Expose()
  @Column({ type: 'character varying', length: 32 })
  public login: string;

  @Expose()
  @Column({ type: 'character varying', length: 32, nullable: true })
  public groupName: string | null;

  @Expose()
  @Column({ length: 80 })
  public accessToken: string;

  @Expose()
  @Column({ length: 80 })
  public refreshToken: string;

  @Expose()
  @Column({ type: 'boolean', default: false })
  public isBanned: boolean;

  @Expose()
  @Column({ type: 'enum', enum: UserRole, default: UserRole.DEFAULT })
  public role: UserRole;

  @Expose()
  @OneToMany(() => UserSocial, (social) => social.user)
  public socials: UserSocial[];

  @Expose()
  @CreateDateColumn()
  public createdAt: Date;

  @Expose()
  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(input?: Partial<User>) {
    if (input) {
      Object.assign(this, plainToClass(User, input));
    }
  }
}
