import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FichasController } from './fichas.controller';
import { FichasService } from './fichas.service';

@Module({
  imports:     [NotificationsModule],
  controllers: [FichasController],
  providers:   [FichasService],
  exports:     [FichasService],
})
export class FichasModule {}
