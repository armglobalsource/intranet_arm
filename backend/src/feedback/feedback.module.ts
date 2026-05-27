import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { StorageModule } from '../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    StorageModule,
    NotificationsModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
