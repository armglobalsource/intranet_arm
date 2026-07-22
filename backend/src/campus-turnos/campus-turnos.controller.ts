import {
  Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CampusTurnosService } from './campus-turnos.service';
import {
  CreateAdministradorDto, UpdateAdministradorDto,
  CreateEquipoDto, UpdateEquipoDto,
  GenerarCalendarioDto, UpdateTurnoDto,
} from './dto/campus-turno.dto';

// Solo admin puede escribir — sin permiso granular en el catálogo por ahora (ver plan).
function requireAdmin(user: any) {
  const isAdmin = user?.role === 'admin' || (user?.permissions ?? []).includes('*');
  if (!isAdmin) throw new ForbiddenException('Solo un administrador puede modificar el calendario de turnos');
}

@UseGuards(JwtAuthGuard)
@Controller('campus-turnos')
export class CampusTurnosController {
  constructor(private readonly service: CampusTurnosService) {}

  @Get('administradores')
  findAdministradores(@Query('campusId', ParseIntPipe) campusId: number) {
    return this.service.findAdministradores(campusId);
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
  findEquipos(@Query('campusId', ParseIntPipe) campusId: number) {
    return this.service.findEquipos(campusId);
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
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findTurnos(campusId, desde, hasta);
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
