import {
  BadRequestException, Controller, Get, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { hasPermission } from '../common/permissions';
import { PostgresEstadisticasService } from './postgres-estadisticas.service';
import { GroupBy } from './postgres-estadisticas.service';
import { RecordType } from './postgres-estadisticas.service';
import { statisticsRange } from './statistics-range';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('estadisticas:view')
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticas: PostgresEstadisticasService) {}

  @Get()
  async dashboard(
    @Query('year') yearText: string,
    @Query('groupBy') groupByText: string | undefined,
    @Query('campusId') campusIdText: string | undefined,
    @Query('type') typeText: string | undefined,
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('country') country?: string,
    @Query('period') period?: string,
  ) {
    const year = Number(yearText);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year inválido');
    }

    const groupBy: GroupBy = groupByText === 'year' ? 'year' : groupByText === 'week' ? 'week' : 'month';
    if (groupByText && !['week', 'month', 'year'].includes(groupByText)) {
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
    if (campusIdText !== undefined && (!/^\d+$/.test(campusIdText) || !Number.isSafeInteger(requestedCampusId) || requestedCampusId! <= 0)) {
      throw new BadRequestException('campusId inválido');
    }

    if (!canViewAll && (!Number.isSafeInteger(Number(user.campusId)) || Number(user.campusId) <= 0)) {
      throw new BadRequestException('Tu cuenta no tiene un campus asignado');
    }
    if (!canViewAll && requestedCampusId && requestedCampusId !== Number(user.campusId)) {
      throw new BadRequestException('No puedes consultar otro campus');
    }

    if (period !== undefined && period !== 'history') throw new BadRequestException('Período inválido');
    const history = period === 'history';
    statisticsRange(year, from, to, history);
    if (country && country.length > 100) throw new BadRequestException('País inválido');
    return this.estadisticas.dashboard({
      year,
      groupBy,
      type,
      campusId: canViewAll ? requestedCampusId : Number(user.campusId),
      canViewAll,
      from, to, country, history,
    });
  }
}
