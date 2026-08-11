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

import { UserSocial } from '../../user/entity/user-social.entity';
import {
  ScheduleNotificationTargetDayOffset,
  ScheduleNotificationTargetType,
} from '../schedule-notification.types';

@Entity()
@Index(['userSocialId', 'isEnabled'])
export class ScheduleNotification {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => UserSocial, { onDelete: 'CASCADE' })
  @JoinColumn()
  public userSocial: UserSocial;

  @Column()
  public userSocialId: number;

  @Column({ type: 'enum', enum: SocialType })
  public transport: SocialType;

  @Column({ type: 'enum', enum: ScheduleNotificationTargetType })
  public targetType: ScheduleNotificationTargetType;

  @Column({ type: 'character varying', length: 128 })
  public targetId: string;

  @Column({ type: 'smallint' })
  public deliveryHour: number;

  @Column({ type: 'smallint', default: 0 })
  public deliveryMinute: number;

  @Column({ type: 'smallint' })
  public targetDayOffset: ScheduleNotificationTargetDayOffset;

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
