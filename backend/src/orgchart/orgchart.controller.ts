import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrgChartService } from './orgchart.service';
import { CreateOrgAreaDto, UpdateOrgAreaDto, CreateOrgNodeDto, UpdateOrgNodeDto, LinkUserDto } from './dto/create-orgchart.dto';

@ApiTags('OrgChart')
@ApiBearerAuth()
@Controller({ path: 'orgchart', version: '1' })
export class OrgChartController {
  constructor(private readonly service: OrgChartService) {}

  @Get('areas')
  @ApiOperation({ summary: 'Listar todas las áreas del organigrama' })
  getAreas() {
    return this.service.getAreas();
  }

  @Get('areas/:slug/tree')
  @ApiOperation({ summary: 'Obtener el árbol completo de un área (incluye datos del usuario vinculado)' })
  getAreaTree(@Param('slug') slug: string) {
    return this.service.getAreaTree(slug);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar personas en todos los organigramas' })
  @ApiQuery({ name: 'q', required: true, description: 'Texto a buscar' })
  search(@Query('q') q: string) {
    return this.service.searchNodes(q);
  }

  @Post('areas')
  @ApiOperation({ summary: 'Crear un área' })
  createArea(@Body() dto: CreateOrgAreaDto) {
    return this.service.createArea(dto);
  }

  @Patch('areas/:id')
  @ApiOperation({ summary: 'Actualizar nombre, descripción o color de un área' })
  updateArea(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgAreaDto) {
    return this.service.updateArea(id, dto);
  }

  @Post('nodes')
  @ApiOperation({ summary: 'Crear un nodo en el árbol' })
  createNode(@Body() dto: CreateOrgNodeDto) {
    return this.service.createNode(dto);
  }

  @Patch('nodes/:id')
  @ApiOperation({ summary: 'Actualizar nombre, rol o descripción de un nodo' })
  updateNode(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgNodeDto) {
    return this.service.updateNode(id, dto);
  }

  @Patch('nodes/:id/link-user')
  @ApiOperation({ summary: 'Vincular o desvincular un usuario de un nodo. Enviar userId:null para desvincular.' })
  linkUser(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkUserDto) {
    return this.service.linkUser(id, dto.userId);
  }

  @Delete('nodes/:id')
  @ApiOperation({ summary: 'Desactivar un nodo (soft delete)' })
  removeNode(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeNode(id);
  }
}
