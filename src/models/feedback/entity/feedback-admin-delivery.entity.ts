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

import { FeedbackAdminDeliveryStatus } from '../feedback.types';

import { Feedback } from './feedback.entity';

/** Прогресс доставки одного feedback конкретному администратору транспорта. */
@Entity()
@Index(['social', 'status', 'retryAt'])
@Index(['feedbackId', 'social', 'adminId'], { unique: true })
export class FeedbackAdminDelivery {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => Feedback, (feedback) => feedback.adminDeliveries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'feedbackId' })
  public feedback: Feedback;

  @Column()
  public feedbackId: number;

  @Column({ type: 'enum', enum: SocialType })
  public social: SocialType;

  /** Строка исключает потерю точности при Telegram/VK bigint identifier. */
  @Column({ type: 'character varying', length: 32 })
  public adminId: string;

  @Column({
    type: 'enum',
    enum: FeedbackAdminDeliveryStatus,
    default: FeedbackAdminDeliveryStatus.Pending,
  })
  public status: FeedbackAdminDeliveryStatus;

  @Column({ type: 'timestamp', nullable: true })
  public headerSentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  public deliveredAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  public attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  public retryAt: Date | null;

  @Column({ type: 'text', nullable: true })
  public lastError: string | null;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
