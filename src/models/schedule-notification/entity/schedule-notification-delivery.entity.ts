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

import { ScheduleNotificationDeliveryStatus } from '../schedule-notification.types';

import { ScheduleNotification } from './schedule-notification.entity';

@Entity()
@Index(['notificationId', 'scheduledFor'], { unique: true })
export class ScheduleNotificationDelivery {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => ScheduleNotification, { onDelete: 'CASCADE' })
  @JoinColumn()
  public notification: ScheduleNotification;

  @Column()
  public notificationId: number;

  @Column({ type: 'timestamp with time zone' })
  public scheduledFor: Date;

  @Column({ type: 'enum', enum: ScheduleNotificationDeliveryStatus })
  public status: ScheduleNotificationDeliveryStatus;

  @Column({ type: 'character varying', nullable: true })
  public sentMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  public error: string | null;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
