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
  FeedbackCategory,
  FeedbackContent,
  FeedbackDeliveryStatus,
} from '../feedback.types';

/** Подтверждённая пользователем обратная связь и результат её доставки. */
@Entity()
@Index(['userSocialId', 'createdAt'])
@Index(['social', 'createdAt'])
export class Feedback {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => UserSocial, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  public userSocial?: UserSocial | null;

  @Column({ nullable: true })
  public userSocialId: number | null;

  @Column({ type: 'enum', enum: SocialType })
  public social: SocialType;

  @Column({ type: 'enum', enum: FeedbackCategory })
  public category: FeedbackCategory;

  /** Идентификатор ЛС-источника; строка исключает потерю bigint в JavaScript. */
  @Column({ type: 'character varying', length: 32 })
  public sourcePeerId: string;

  /** Текст, IDs и безопасные метаданные исходных сообщений без файловых байтов. */
  @Column({ type: 'jsonb' })
  public content: FeedbackContent;

  @Column({
    type: 'enum',
    enum: FeedbackDeliveryStatus,
    default: FeedbackDeliveryStatus.Pending,
  })
  public deliveryStatus: FeedbackDeliveryStatus;

  @Column({ type: 'timestamp', nullable: true })
  public deliveredAt: Date | null;

  @Column({ type: 'text', nullable: true })
  public deliveryError: string | null;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
