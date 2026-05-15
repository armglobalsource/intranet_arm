import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { OrgChartService } from './orgchart.service';
import {
  CreateOrgAreaDto, UpdateOrgAreaDto,
  CreateOrgTeamDto, UpdateOrgTeamDto,
  CreateOrgMembershipDto, UpdateOrgMembershipDto,
} from './dto/create-orgchart.dto';

@ApiTags('OrgChart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Crear área' })
  createArea(@Body() dto: CreateOrgAreaDto) { return this.service.createArea(dto); }

  @Patch('areas/:id')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Actualizar área' })
  updateArea(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgAreaDto) {
    return this.service.updateArea(id, dto);
  }

  @Delete('areas/:id')
  @RequirePermission('orgchart:delete')
  @ApiOperation({ summary: 'Desactivar área y sus equipos (soft delete)' })
  deleteArea(@Param('id', ParseIntPipe) id: number) { return this.service.deleteArea(id); }

  @Post('areas/:id/logo')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Subir imagen/logo de un área' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadAreaLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) { return this.service.uploadAreaLogo(id, file); }

  // ── EQUIPOS ──────────────────────────────────────────────────

  @Get('teams')
  @ApiOperation({ summary: 'Listar equipos activos' })
  getTeams() { return this.service.getTeams(); }

  @Get('teams/all')
  @ApiOperation({ summary: 'Listar todos los equipos incluyendo inactivos (admin)' })
  getAllTeams() { return this.service.getAllTeams(); }

  @Post('teams')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Crear equipo dentro de un área' })
  createTeam(@Body() dto: CreateOrgTeamDto) { return this.service.createTeam(dto); }

  @Patch('teams/:id')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Actualizar equipo' })
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgTeamDto) {
    return this.service.updateTeam(id, dto);
  }

  @Delete('teams/:id')
  @RequirePermission('orgchart:delete')
  @ApiOperation({ summary: 'Desactivar equipo (soft delete)' })
  deleteTeam(@Param('id', ParseIntPipe) id: number) { return this.service.deleteTeam(id); }

  @Post('teams/:id/logo')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Subir logo/imagen de un equipo' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadTeamLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) { return this.service.uploadTeamLogo(id, file); }

  // ── MEMBRESÍAS ───────────────────────────────────────────────

  @Post('memberships')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Agregar usuario a un área o equipo con un rol' })
  createMembership(@Body() dto: CreateOrgMembershipDto) { return this.service.createMembership(dto); }

  @Patch('memberships/:id')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Actualizar rol o sortOrder de una membresía' })
  updateMembership(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgMembershipDto) {
    return this.service.updateMembership(id, dto);
  }

  @Delete('memberships/:id')
  @RequirePermission('orgchart:edit')
  @ApiOperation({ summary: 'Eliminar membresía (quita al usuario del área/equipo)' })
  deleteMembership(@Param('id', ParseIntPipe) id: number) { return this.service.deleteMembership(id); }

  // ── PERFIL USUARIO ───────────────────────────────────────────

  @Get('users/:userId')
  @ApiOperation({ summary: 'Perfil completo de un usuario en el organigrama (todas sus membresías)' })
  getUserOrgProfile(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.getUserOrgProfile(userId);
  }

  // ── BÚSQUEDA ─────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Buscar usuarios en el organigrama' })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') q: string) { return this.service.search(q); }
}
