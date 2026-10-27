import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { PostgresCancionesService } from './postgres-canciones.service';
import { UpdateCancionDto, UpsertCancionDto } from './dto/cancion.dto';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('canciones')
export class CancionesController {
  constructor(private readonly svc: PostgresCancionesService) {}

  /** GET /api/v1/canciones?q=aleluya  — buscar canciones */
  @Get()
  search(@Query('q') q?: string) {
    return this.svc.search(q);
  }

  @Get(':id')
  detail(@Param('id') id: string) { return this.svc.detail(id); }

  @Patch(':id')
  @RequirePermission('fichas:edit')
  update(@Param('id') id: string, @Body() dto: UpdateCancionDto) { return this.svc.update(id, dto); }

  /** POST /api/v1/canciones  — upsert canción desde set list */
  @Post()
  upsert(@Body() dto: UpsertCancionDto) {
    return this.svc.upsert(dto);
  }
}
