import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostgresAnunciosService } from './postgres-anuncios.service';
import { CreateAnuncioDto, UpdateAnuncioDto } from './dto/anuncio.dto';

@UseGuards(JwtAuthGuard)
@Controller('anuncios')
export class AnunciosController {
  constructor(private readonly anuncios: PostgresAnunciosService) {}

  /** Activos y no vencidos para el usuario (feed de miembros). */
  @Get('active')
  findActive(@Query('campus') campus?: string) {
    return this.anuncios.findActive(campus);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('anuncios:view')
  findAll(@Query('campusId') campusId?: string) {
    return this.anuncios.findAll(campusId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('anuncios:view')
  findOne(@Param('id') id: string) {
    return this.anuncios.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('anuncios:create')
  create(@Body() dto: CreateAnuncioDto, @CurrentUser() user: any) {
    return this.anuncios.create(dto, { sub: user.sub, email: user.email });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('anuncios:edit')
  update(@Param('id') id: string, @Body() dto: UpdateAnuncioDto) {
    return this.anuncios.update(id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('anuncios:edit')
  deactivate(@Param('id') id: string) {
    return this.anuncios.deactivate(id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('anuncios:delete')
  remove(@Param('id') id: string) {
    return this.anuncios.remove(id);
  }
}
