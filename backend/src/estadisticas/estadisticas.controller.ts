import {
  BadRequestException, Controller, Get, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { hasPermission } from '../common/permissions';
import { EstadisticasService, GroupBy, RecordType } from './estadisticas.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('estadisticas:view')
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  @Get()
  async dashboard(
    @Query('year') yearText: string,
    @Query('groupBy') groupByText: string | undefined,
    @Query('campusId') campusIdText: string | undefined,
    @Query('type') typeText: string | undefined,
    @CurrentUser() user: any,
  ) {
    const year = Number(yearText);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year inválido');
    }

    const groupBy: GroupBy = groupByText === 'week' ? 'week' : 'month';
    if (groupByText && !['week', 'month'].includes(groupByText)) {
      throw new BadRequestException('groupBy inválido');
    }

    const type: RecordType = ['encuentro', 'evento'].includes(typeText ?? '')
      ? typeText as RecordType
      : 'all';
    if (typeText && !['all', 'encuentro', 'evento'].includes(typeText)) {
      throw new BadRequestException('type inválido');
    }

    const canViewAll = hasPermission(user.permissions ?? [], 'estadisticas:viewAll');
    const requestedCampusId = campusIdText ? Number(campusIdText) : undefined;
    if (campusIdText && !Number.isInteger(requestedCampusId)) {
      throw new BadRequestException('campusId inválido');
    }

    if (!canViewAll && !user.campusId) {
      throw new BadRequestException('Tu cuenta no tiene un campus asignado');
    }
    if (!canViewAll && requestedCampusId && requestedCampusId !== Number(user.campusId)) {
      throw new BadRequestException('No puedes consultar otro campus');
    }

    return this.estadisticas.dashboard({
      year,
      groupBy,
      type,
      campusId: canViewAll ? requestedCampusId : Number(user.campusId),
      canViewAll,
    });
  }
}
