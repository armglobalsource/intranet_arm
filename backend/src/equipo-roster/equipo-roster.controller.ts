import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PostgresEquipoRosterService } from './postgres-equipo-roster.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('equipo-roster')
export class EquipoRosterController {
  constructor(private readonly svc: PostgresEquipoRosterService) {}

  /**
   * Listado de personas agrupadas por equipo (worship / técnico / ninguno)
   * con su estado de disponibilidad para la semana de una ficha técnica.
   * Gateado por fichas:view — cualquiera que pueda ver una ficha puede ver
   * quién está disponible para armarla.
   */
  @Get()
  @RequirePermission('fichas:view')
  getRoster(
    @Query('campusId') campusId: string,
    @Query('week')     week: string,
  ) {
    return this.svc.getRoster(Number(campusId), week);
  }
}
