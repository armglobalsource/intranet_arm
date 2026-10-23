import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PostgresContentsService } from './postgres-content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Contents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'content', version: '1' })
export class ContentsController {
  constructor(private readonly service: PostgresContentsService) {}

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
    @CurrentUser() user?: any,
  ) {
    return this.service.findNews(campusId, status, user);
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
    // Admin sin campus asignado: ve todas las noticias de campus
    const isAdmin = (user?.permissions ?? []).includes('*');
    if (isAdmin && !user?.campusId) {
      return this.service.findPublished('campus', undefined, true);
    }
    const campusId = user?.campusId ? String(user.campusId) : undefined;
    return this.service.findPublished('campus', campusId);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Obtener por ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('content:create')
  @ApiOperation({ summary: 'Crear noticia' })
  create(@Body() dto: CreateContentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('content:publish')
  @ApiOperation({ summary: 'Actualizar noticia' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateContentDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('content:delete')
  @ApiOperation({ summary: 'Eliminar noticia' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
