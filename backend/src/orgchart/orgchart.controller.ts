import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrgChartService } from './orgchart.service';
import {
  CreateOrgAreaDto, UpdateOrgAreaDto,
  CreateOrgTeamDto, UpdateOrgTeamDto,
  CreateOrgMembershipDto, UpdateOrgMembershipDto,
} from './dto/create-orgchart.dto';

@ApiTags('OrgChart')
@ApiBearerAuth()
@Controller({ path: 'orgchart', version: '1' })
export class OrgChartController {
  constructor(private readonly service: OrgChartService) {}

  // ── ÁREAS ────────────────────────────────────────────────────

  @Get('areas')
  @ApiOperation({ summary: 'Listar áreas activas' })
  getAreas() { return this.service.getAreas(); }

  @Get('areas/all')
  @ApiOperation({ summary: 'Listar todas las áreas incluyendo inactivas (admin)' })
  getAllAreas() { return this.service.getAllAreas(); }

  @Get('areas/:slug/tree')
  @ApiOperation({ summary: 'Árbol completo de un área: líderes + equipos con sus miembros' })
  getAreaTree(@Param('slug') slug: string) { return this.service.getAreaTree(slug); }

  @Post('areas')
  @ApiOperation({ summary: 'Crear área' })
  createArea(@Body() dto: CreateOrgAreaDto) { return this.service.createArea(dto); }

  @Patch('areas/:id')
  @ApiOperation({ summary: 'Actualizar área' })
  updateArea(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgAreaDto) {
    return this.service.updateArea(id, dto);
  }

  @Delete('areas/:id')
  @ApiOperation({ summary: 'Desactivar área y sus equipos (soft delete)' })
  deleteArea(@Param('id', ParseIntPipe) id: number) { return this.service.deleteArea(id); }

  // ── EQUIPOS ──────────────────────────────────────────────────

  @Get('teams')
  @ApiOperation({ summary: 'Listar equipos activos' })
  getTeams() { return this.service.getTeams(); }

  @Get('teams/all')
  @ApiOperation({ summary: 'Listar todos los equipos incluyendo inactivos (admin)' })
  getAllTeams() { return this.service.getAllTeams(); }

  @Post('teams')
  @ApiOperation({ summary: 'Crear equipo dentro de un área' })
  createTeam(@Body() dto: CreateOrgTeamDto) { return this.service.createTeam(dto); }

  @Patch('teams/:id')
  @ApiOperation({ summary: 'Actualizar equipo' })
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgTeamDto) {
    return this.service.updateTeam(id, dto);
  }

  @Delete('teams/:id')
  @ApiOperation({ summary: 'Desactivar equipo (soft delete)' })
  deleteTeam(@Param('id', ParseIntPipe) id: number) { return this.service.deleteTeam(id); }

  // ── MEMBRESÍAS ───────────────────────────────────────────────

  @Post('memberships')
  @ApiOperation({ summary: 'Agregar usuario a un área o equipo con un rol' })
  createMembership(@Body() dto: CreateOrgMembershipDto) { return this.service.createMembership(dto); }

  @Patch('memberships/:id')
  @ApiOperation({ summary: 'Actualizar rol o sortOrder de una membresía' })
  updateMembership(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgMembershipDto) {
    return this.service.updateMembership(id, dto);
  }

  @Delete('memberships/:id')
  @ApiOperation({ summary: 'Eliminar membresía (quita al usuario del área/equipo)' })
  deleteMembership(@Param('id', ParseIntPipe) id: number) { return this.service.deleteMembership(id); }

  // ── BÚSQUEDA ─────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Buscar usuarios en el organigrama' })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') q: string) { return this.service.search(q); }
}
