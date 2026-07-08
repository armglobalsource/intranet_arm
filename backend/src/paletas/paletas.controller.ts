import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PaletasService } from './paletas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaletaDto } from './dto/paleta.dto';

@UseGuards(JwtAuthGuard)
@Controller('paletas')
export class PaletasController {
  constructor(private readonly svc: PaletasService) {}

  /** GET /api/v1/paletas — paletas de outfit activas */
  @Get()
  findAll() {
    return this.svc.findAll();
  }

  /** POST /api/v1/paletas — crea una nueva paleta */
  @Post()
  create(@Body() dto: CreatePaletaDto) {
    return this.svc.create(dto);
  }
}
