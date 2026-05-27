import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CancionesService } from './canciones.service';
import { UpsertCancionDto } from './dto/cancion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('canciones')
export class CancionesController {
  constructor(private readonly svc: CancionesService) {}

  /** GET /api/v1/canciones?q=aleluya  — buscar canciones */
  @Get()
  search(@Query('q') q?: string) {
    return this.svc.search(q);
  }

  /** POST /api/v1/canciones  — upsert canción desde set list */
  @Post()
  upsert(@Body() dto: UpsertCancionDto) {
    return this.svc.upsert(dto);
  }
}
