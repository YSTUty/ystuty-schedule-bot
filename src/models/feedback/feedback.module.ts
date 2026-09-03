import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FeedbackAdminDelivery } from './entity/feedback-admin-delivery.entity';
import { Feedback } from './entity/feedback.entity';
import { FeedbackService } from './feedback.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Feedback, FeedbackAdminDelivery])],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
