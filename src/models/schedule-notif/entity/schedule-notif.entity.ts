import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SocialType } from '@my-common/constants';

import { Conversation } from '../../social/entity/conversation.entity';
import { UserSocial } from '../../user/entity/user-social.entity';
import {
  ScheduleNotifTargetDayOffset,
  ScheduleNotifTargetType,
} from '../schedule-notif.types';

@Entity('schedule_notification')
@Index(['userSocialId', 'isEnabled'])
export class ScheduleNotif {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => UserSocial, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn()
  public userSocial: UserSocial | null;

  @Column({ nullable: true })
  public userSocialId: number | null;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn()
  public conversation: Conversation | null;

  /** Для беседы допустима ровно одна текущая рассылка. */
  @Column({ nullable: true, unique: true })
  public conversationId: number | null;

  @Column({ type: 'enum', enum: SocialType })
  public transport: SocialType;

  @Column({ type: 'enum', enum: ScheduleNotifTargetType })
  public targetType: ScheduleNotifTargetType;

  @Column({ type: 'character varying', length: 128 })
  public targetId: string;

  @Column({ type: 'smallint' })
  public deliveryHour: number;

  @Column({ type: 'smallint', default: 0 })
  public deliveryMinute: number;

  @Column({ type: 'smallint' })
  public targetDayOffset: ScheduleNotifTargetDayOffset;

  @Column({ type: 'smallint', array: true })
  public weekdays: number[];

  @Column({ type: 'boolean', default: true })
  public isEnabled: boolean;

  /** Количество обнаружений отсутствующей цели в Schedule API. */
  @Column({ type: 'smallint', default: 0 })
  public missingTargetAttempts: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  public lastDeliveredAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  public lastFailedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  public lastError: string | null;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
