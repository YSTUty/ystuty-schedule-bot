import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SocialType } from '@my-common/constants';

import { UserSocial } from '../../user/entity/user-social.entity';
import { BroadcastFeedbackAction } from '../broadcast.types';

import { BroadcastCampaign } from './broadcast-campaign.entity';
import { BroadcastDelivery } from './broadcast-delivery.entity';

/** Один подтверждённый клик получателя по feedback-кнопке рассылки. */
@Entity()
@Index(['campaignId', 'createdAt'])
@Index(['deliveryId', 'createdAt'])
@Index('UQ_broadcast_feedback_initial_delivery', ['deliveryId'], {
  unique: true,
  where: `"action" = 'initial'`,
})
export class BroadcastFeedback {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => BroadcastCampaign, (campaign) => campaign.feedbacks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaignId' })
  public campaign: BroadcastCampaign;

  @Column()
  public campaignId: number;

  @ManyToOne(() => BroadcastDelivery, (delivery) => delivery.feedbacks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deliveryId' })
  public delivery: BroadcastDelivery;

  @Column()
  public deliveryId: number;

  @ManyToOne(() => UserSocial, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  public userSocial?: UserSocial | null;

  @Column({ nullable: true })
  public userSocialId: number | null;

  @Column({ type: 'enum', enum: SocialType })
  public social: SocialType;

  /** Первый клик можно сохранить один раз, повторные клики — без ограничения. */
  @Column({ type: 'character varying', length: 16 })
  public action: BroadcastFeedbackAction;

  @CreateDateColumn()
  public createdAt: Date;
}
