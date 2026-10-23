import {
  Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostgresCampusTurnosService } from './postgres-campus-turnos.service';
import {
  CAMPUS_TURNO_TIPOS, CampusTurnoTipo,
  CreateAdministradorDto, UpdateAdministradorDto,
  CreateEquipoDto, UpdateEquipoDto,
  GenerarCalendarioDto, UpdateTurnoDto,
} from './dto/campus-turno.dto';

// Solo admin puede escribir — sin permiso granular en el catálogo por ahora (ver plan).
function requireAdmin(user: any) {
  const isAdmin = user?.role === 'admin' || (user?.permissions ?? []).includes('*');
  if (!isAdmin) throw new ForbiddenException('Solo un administrador puede modificar el calendario de turnos');
}

// 'administradores' es el default por compatibilidad con datos creados antes de
// soportar múltiples tipos (ver matchesTipo() en el service).
function parseTipo(tipo?: string): CampusTurnoTipo {
  return CAMPUS_TURNO_TIPOS.includes(tipo as CampusTurnoTipo) ? (tipo as CampusTurnoTipo) : 'administradores';
}

@UseGuards(JwtAuthGuard)
@Controller('campus-turnos')
export class CampusTurnosController {
  constructor(private readonly service: PostgresCampusTurnosService) {}

  @Get('administradores')
  findAdministradores(@Query('campusId', ParseIntPipe) campusId: number, @Query('tipo') tipo?: string) {
    return this.service.findAdministradores(campusId, parseTipo(tipo));
  }

  @Post('administradores')
  createAdministrador(@Body() dto: CreateAdministradorDto, @CurrentUser() user: any) {
    requireAdmin(user);
    return this.service.createAdministrador(dto);
  }

  @Patch('administradores/:id')
  updateAdministrador(
    @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdministradorDto, @CurrentUser() user: any,
  ) {
    requireAdmin(user);
    return this.service.updateAdministrador(id, dto);
  }

  @Get('equipos')
  findEquipos(@Query('campusId', ParseIntPipe) campusId: number, @Query('tipo') tipo?: string) {
    return this.service.findEquipos(campusId, parseTipo(tipo));
  }

  @Post('equipos')
  createEquipo(@Body() dto: CreateEquipoDto, @CurrentUser() user: any) {
    requireAdmin(user);
    return this.service.createEquipo(dto);
  }

  @Patch('equipos/:id')
  updateEquipo(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEquipoDto, @CurrentUser() user: any) {
    requireAdmin(user);
    return this.service.updateEquipo(id, dto);
  }

  @Get('turnos')
  findTurnos(
    @Query('campusId', ParseIntPipe) campusId: number,
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findTurnos(campusId, parseTipo(tipo), desde, hasta);
  }

  @Post('turnos/generar')
  generar(@Body() dto: GenerarCalendarioDto, @CurrentUser() user: any) {
    requireAdmin(user);
    return this.service.generar(dto);
  }

  @Patch('turnos/:id')
  updateTurno(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTurnoDto, @CurrentUser() user: any) {
    requireAdmin(user);
    return this.service.updateTurno(id, dto);
  }
}
