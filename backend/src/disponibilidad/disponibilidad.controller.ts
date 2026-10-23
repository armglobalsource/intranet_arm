import {
  Body, Controller, Get, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostgresDisponibilidadService } from './postgres-availability';
import { BulkSubmitDto } from './dto/disponibilidad.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('disponibilidad')
export class DisponibilidadController {
  constructor(private readonly svc: PostgresDisponibilidadService) {}

  /** Slots de encuentro de una semana para un campus (cualquier usuario autenticado) */
  @Get('encounters')
  getEncounters(
    @Query('campusId') campusId: string,
    @Query('week')     week: string,
  ) {
    return this.svc.getEncounters(Number(campusId), week);
  }

  /** Guardar disponibilidad de todos los slots de la semana (voluntario worship) */
  @Post('bulk-submit')
  @RequirePermission('disponibilidad:submit')
  bulkSubmit(@Body() dto: BulkSubmitDto, @CurrentUser() user: any) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    return this.svc.bulkSubmit(user.sub, name, dto);
  }

  /** Todos mis compromisos disponibles — para el calendario del dashboard */
  @Get('my-commitments')
  @RequirePermission('disponibilidad:submit')
  getMyCommitments(
    @Query('campusId') campusId: string,
    @CurrentUser()     user: any,
  ) {
    return this.svc.getMyCommitments(user.sub, Number(campusId));
  }

  /** Mis respuestas para una semana (voluntario worship) */
  @Get('mine')
  @RequirePermission('disponibilidad:submit')
  getMyWeek(
    @Query('campusId') campusId: string,
    @Query('week')     week: string,
    @CurrentUser()     user: any,
  ) {
    return this.svc.getMyWeek(user.sub, Number(campusId), week);
  }

  /** Matriz voluntario × encuentro (productor / admin) */
  @Get('matrix')
  @RequirePermission('disponibilidad:view')
  getMatrix(
    @Query('campusId') campusId: string,
    @Query('week')     week: string,
  ) {
    return this.svc.getMatrix(Number(campusId), week);
  }

  /** Semanas con submissions para un campus (productor / admin) */
  @Get('weeks')
  @RequirePermission('disponibilidad:view')
  getWeeks(@Query('campusId') campusId: string) {
    return this.svc.getWeeks(Number(campusId));
  }
}
