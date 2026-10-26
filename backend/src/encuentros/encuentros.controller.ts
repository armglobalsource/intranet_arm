import {
  BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostgresCampusService } from '../campus/postgres-campus.service';
import { resolveCampusScope, applyLimit } from '../common/campus-scope';
import { PostgresEncuentrosService } from './postgres-encuentros.service';
import { CreateEncuentroDto, ObservarEncuentroDto, UpdateEncuentroDto } from './dto/encuentro.dto';
import { allCampus } from './encuentros.scope';

@UseGuards(JwtAuthGuard)
@Controller('encuentros')
export class EncuentrosController {
  constructor(
    private readonly encuentros: PostgresEncuentrosService,
    private readonly campusService: PostgresCampusService,
  ) {}

  /** Resumen agregado del campus del usuario autenticado (nunca del campus que el cliente pida). */
  @Get('resumen')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:create')
  async resumen(
    @Query('year')  yearStr: string,
    @Query('month') monthStr: string | undefined,
    @CurrentUser()  user: any,
  ) {
    if (!user.campusId) throw new BadRequestException('Tu cuenta no tiene un campus asignado.');
    const year  = parseInt(yearStr, 10);
    const month = monthStr !== undefined ? parseInt(monthStr, 10) : undefined;
    if (!Number.isInteger(year)) throw new BadRequestException('year inválido');
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      throw new BadRequestException('month inválido (1-12)');
    }
    const campus = await this.campusService.findOne(user.campusId);
    return this.encuentros.resumen(campus.name, year, month);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:view')
  async findAll(
    @CurrentUser()     user: any,
    @Query('campusId') campusId?: string,
    @Query('periodo')  periodo?: any,
    @Query('limit')    limit?: string,
  ) {
    const campus = allCampus(user) ? (campusId || undefined) : await resolveCampusScope(user, campusId, this.campusService);
    if (campus === null) return [];
    return applyLimit(await this.encuentros.findAll(campus, periodo), limit);
  }

  /** Encuentros que según los horarios del campus aún no se reportan (últimos 14 días por defecto, máximo 60). */
  @Get('pendientes')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:create')
  pendientes(@CurrentUser() user: any, @Query('dias') diasText?: string) {
    const dias = diasText === undefined ? 14 : Number(diasText);
    if (!Number.isInteger(dias) || dias < 1 || dias > 60) throw new BadRequestException('dias debe ser un número entre 1 y 60');
    return this.encuentros.pendientes(user, dias);
  }

  /** Reportes por revisar de los campus que el usuario administra (permiso o lista del campus). */
  @Get('revision')
  revision(@CurrentUser() user: any) {
    return this.encuentros.revision(user);
  }

  @Patch(':id/subir')
  subir(@Param('id') id: string, @CurrentUser() user: any) {
    return this.encuentros.subir(id, user);
  }

  @Patch(':id/observar')
  observar(@Param('id') id: string, @Body() dto: ObservarEncuentroDto, @CurrentUser() user: any) {
    return this.encuentros.observar(id, dto.observacion, user);
  }

  @Get('mine')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:create')
  findMine(@CurrentUser() user: any) {
    return this.encuentros.findMine(user.sub);
  }

  // Lo ve quien tiene «Ver encuentros» en su campus o quien revisa los reportes de ese campus.
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.encuentros.findOneFor(id, user);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:create')
  create(@Body() dto: CreateEncuentroDto, @CurrentUser() user: any) {
    return this.encuentros.create(dto, user);
  }

  // Quién edita o elimina depende del estado del reporte y de quién lo envió: lo decide el servicio.
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEncuentroDto, @CurrentUser() user: any) {
    return this.encuentros.update(id, dto, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.encuentros.remove(id, user);
  }
}
