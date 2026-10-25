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
import { CreateEncuentroDto, UpdateEncuentroDto } from './dto/encuentro.dto';
import { allCampus, assertRecordCampus } from './encuentros.scope';

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

  @Get('mine')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:create')
  findMine(@CurrentUser() user: any) {
    return this.encuentros.findMine(user.sub);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:view')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const record = await this.encuentros.findOne(id);
    assertRecordCampus(record, user);
    return record;
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:create')
  create(@Body() dto: CreateEncuentroDto, @CurrentUser() user: any) {
    return this.encuentros.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:edit')
  async update(@Param('id') id: string, @Body() dto: UpdateEncuentroDto, @CurrentUser() user: any) {
    assertRecordCampus(await this.encuentros.findOne(id), user);
    return this.encuentros.update(id, dto, { sub: user.sub, email: user.email });
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    assertRecordCampus(await this.encuentros.findOne(id), user);
    return this.encuentros.remove(id);
  }
}
