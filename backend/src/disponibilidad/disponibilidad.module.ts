import { Module } from '@nestjs/common';
import { CampusModule } from '../campus/campus.module';
import { DisponibilidadController } from './disponibilidad.controller';
import { DisponibilidadService } from './disponibilidad.service';

@Module({
  imports:     [CampusModule],
  controllers: [DisponibilidadController],
  providers:   [DisponibilidadService],
})
export class DisponibilidadModule {}
