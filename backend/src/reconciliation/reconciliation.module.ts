import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CampusModule } from '../campus/campus.module';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports:     [UsersModule, CampusModule],
  controllers: [ReconciliationController],
  providers:   [ReconciliationService],
})
export class ReconciliationModule {}
