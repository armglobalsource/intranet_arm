import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobTitlesModule } from '../job-titles/job-titles.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [NotificationsModule, JobTitlesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
