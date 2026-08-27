import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SocialType } from '@my-common/constants';

import {
  BroadcastActionKeyboard,
  BroadcastAudienceFilter,
  BroadcastCampaignStatus,
  BroadcastFeedbackButton,
  BroadcastMessageMode,
  BroadcastSourceMessage,
} from '../broadcast.types';

import { BroadcastDelivery } from './broadcast-delivery.entity';
import { BroadcastFeedback } from './broadcast-feedback.entity';

@Entity()
@Index(['social', 'status'])
export class BroadcastCampaign {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'enum', enum: SocialType })
  public social: SocialType;

  @Column({ type: 'enum', enum: BroadcastCampaignStatus })
  public status: BroadcastCampaignStatus;

  @Column({ type: 'enum', enum: BroadcastMessageMode })
  public mode: BroadcastMessageMode;

  @Column({ type: 'jsonb' })
  public sourceMessage: BroadcastSourceMessage;

  @Column({ type: 'jsonb' })
  public audienceFilter: BroadcastAudienceFilter;

  /** Короткое описание содержимого для истории кампаний. */
  @Column({ type: 'text', nullable: true })
  public contentPreview: string | null;

  /** Момент завершения попытки удалить отправленные сообщения кампании. */
  @Column({ type: 'timestamp', nullable: true })
  public messagesDeletedAt: Date | null;

  /** Необязательная кнопка feedback под каждым отправленным сообщением. */
  @Column({ type: 'jsonb', nullable: true })
  public feedbackButton: BroadcastFeedbackButton | null;

  /** Дополнительные действия получателя; transport формирует клавиатуру сам. */
  @Column({ type: 'jsonb', nullable: true })
  public actionKeyboard: BroadcastActionKeyboard | null;

  @Column({ type: 'bigint', nullable: true })
  public createdBySocialId: string | null;

  @Column({ type: 'integer', default: 0 })
  public totalCount: number;

  @Column({ type: 'integer', default: 0 })
  public sentCount: number;

  @Column({ type: 'integer', default: 0 })
  public failedCount: number;

  @Column({ type: 'integer', default: 0 })
  public skippedCount: number;

  @Column({ type: 'text', nullable: true })
  public lastError: string | null;

  @OneToMany(() => BroadcastDelivery, (delivery) => delivery.campaign, {
    cascade: ['remove'],
  })
  public deliveries: BroadcastDelivery[];

  @OneToMany(() => BroadcastFeedback, (feedback) => feedback.campaign)
  public feedbacks: BroadcastFeedback[];

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
