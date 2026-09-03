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

import { UserSocial } from '../../user/entity/user-social.entity';
import {
  BroadcastDeliveryFailureKind,
  BroadcastDeliveryStatus,
} from '../broadcast.types';

import { BroadcastCampaign } from './broadcast-campaign.entity';
import { BroadcastFeedback } from './broadcast-feedback.entity';

@Entity()
@Index(['campaignId', 'status'])
export class BroadcastDelivery {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => BroadcastCampaign, (campaign) => campaign.deliveries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  public campaign: BroadcastCampaign;

  @Column()
  public campaignId: number;

  @ManyToOne(() => UserSocial, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  public userSocial?: UserSocial | null;

  @Column({ nullable: true })
  public userSocialId: number | null;

  @Column({ type: 'bigint' })
  public targetSocialId: string;

  @Column({ type: 'enum', enum: BroadcastDeliveryStatus })
  public status: BroadcastDeliveryStatus;

  @Column({ type: 'character varying', nullable: true })
  public sentMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  public error: string | null;

  /** Категория последней ошибки доставки без зависимости от текста transport API. */
  @Column({ type: 'character varying', length: 32, nullable: true })
  public failureKind: BroadcastDeliveryFailureKind | null;

  @Column({ type: 'integer', default: 0 })
  public attempts: number;

  /** Момент следующей попытки после rate limit. */
  @Column({ type: 'timestamp', nullable: true })
  public retryAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  public messageDeletedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  public messageDeleteError: string | null;

  @OneToMany(() => BroadcastFeedback, (feedback) => feedback.delivery)
  public feedbacks: BroadcastFeedback[];

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
