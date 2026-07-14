import { Module } from '@nestjs/common';
import { ArmCatalogosModule } from '../arm-catalogos/arm-catalogos.module';
import { CampusController } from './campus.controller';
import { CampusService } from './campus.service';

@Module({
  imports:     [ArmCatalogosModule],
  controllers: [CampusController],
  providers:   [CampusService],
  exports:     [CampusService],
})
export class CampusModule {}
