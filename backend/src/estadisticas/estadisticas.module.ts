import { Module } from '@nestjs/common';
import { CampusModule } from '../campus/campus.module';
import { ArmCatalogosModule } from '../arm-catalogos/arm-catalogos.module';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';

@Module({
  imports: [CampusModule, ArmCatalogosModule],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
