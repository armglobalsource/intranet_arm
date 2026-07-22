import { Module } from '@nestjs/common';
import { CampusTurnosController } from './campus-turnos.controller';
import { CampusTurnosService } from './campus-turnos.service';

@Module({
  controllers: [CampusTurnosController],
  providers:   [CampusTurnosService],
})
export class CampusTurnosModule {}
