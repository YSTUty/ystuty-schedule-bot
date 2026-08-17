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

import { ScheduleNotifDeliveryStatus } from '../schedule-notif.types';

import { ScheduleNotif } from './schedule-notif.entity';

@Entity('schedule_notification_delivery')
@Index(['notifId', 'scheduledFor'], { unique: true })
export class ScheduleNotifDelivery {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => ScheduleNotif, { onDelete: 'CASCADE' })
  @JoinColumn()
  public notif: ScheduleNotif;

  @Column()
  public notifId: number;

  @Column({ type: 'timestamp with time zone' })
  public scheduledFor: Date;

  @Column({ type: 'enum', enum: ScheduleNotifDeliveryStatus })
  public status: ScheduleNotifDeliveryStatus;

  @Column({ type: 'character varying', nullable: true })
  public sentMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  public error: string | null;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
