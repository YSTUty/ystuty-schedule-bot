import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Feedback } from './entity/feedback.entity';
import { FeedbackService } from './feedback.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Feedback])],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
