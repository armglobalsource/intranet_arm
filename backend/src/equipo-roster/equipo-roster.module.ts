import { Module } from '@nestjs/common';
import { OrgChartModule } from '../orgchart/orgchart.module';
import { DisponibilidadModule } from '../disponibilidad/disponibilidad.module';
import { TecnicosModule } from '../tecnicos/tecnicos.module';
import { EquipoRosterController } from './equipo-roster.controller';
import { EquipoRosterService } from './equipo-roster.service';

@Module({
  imports:     [OrgChartModule, DisponibilidadModule, TecnicosModule],
  controllers: [EquipoRosterController],
  providers:   [EquipoRosterService],
})
export class EquipoRosterModule {}
