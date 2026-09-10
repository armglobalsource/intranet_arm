import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AllowPending } from '../common/decorators/allow-pending.decorator';
import { ArmCatalogosService } from './arm-catalogos.service';
import {
  ARM_CATALOGO_TIPOS, ArmCatalogoTipo, CreateArmCatalogoDto, UpdateArmCatalogoDto,
} from './dto/arm-catalogo.dto';

function parseTipo(tipo: string): ArmCatalogoTipo {
  if (!ARM_CATALOGO_TIPOS.includes(tipo as ArmCatalogoTipo)) {
    throw new BadRequestException(`tipo inválido: "${tipo}" (esperado: ${ARM_CATALOGO_TIPOS.join(', ')})`);
  }
  return tipo as ArmCatalogoTipo;
}

@ApiTags('ArmCatalogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'arm-catalogos', version: '1' })
export class ArmCatalogosController {
  constructor(private readonly service: ArmCatalogosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar catálogo completo (admin) por tipo' })
  findAll(@Query('tipo') tipo: string) {
    return this.service.findAll(parseTipo(tipo));
  }

  @AllowPending()
  @Get('active')
  @ApiOperation({ summary: 'Listar entradas activas de un catálogo (para pickers)' })
  findActive(@Query('tipo') tipo: string) {
    return this.service.findActive(parseTipo(tipo));
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  @ApiOperation({ summary: 'Crear una nueva entrada de catálogo' })
  create(@Body() dto: CreateArmCatalogoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  @ApiOperation({ summary: 'Actualizar label, orden o estado de una entrada' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArmCatalogoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  @ApiOperation({ summary: 'Eliminar una entrada de catálogo' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
