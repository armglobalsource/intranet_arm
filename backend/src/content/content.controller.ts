import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentsService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Contents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'content', version: '1' })
export class ContentsController {
  constructor(private readonly service: ContentsService) {}

  // ── Admin ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar todos los registros' })
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.sub, user.roleId);
  }

  /** Admin: lista noticias con filtros opcionales */
  @Get('news')
  @ApiOperation({ summary: 'Admin — listar noticias con filtros' })
  findNews(
    @Query('campusId') campusId?: string,
    @Query('status')   status?: string,
  ) {
    return this.service.findNews(campusId, status);
  }

  // ── Públicas (autenticado) ─────────────────────────────────────────────────

  @Get('news/global')
  @ApiOperation({ summary: 'Noticias globales publicadas' })
  findGlobal() {
    return this.service.findPublished('global');
  }

  @Get('news/campus')
  @ApiOperation({ summary: 'Noticias del campus del usuario' })
  findCampus(@CurrentUser() user: any) {
    const campusId = user?.campusId ? String(user.campusId) : undefined;
    return this.service.findPublished('campus', campusId);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Obtener por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear noticia' })
  create(@Body() dto: CreateContentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar noticia' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateContentDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar noticia' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
