import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PostgresDocumentsService } from './postgres-documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly service: PostgresDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los registros' })
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.sub, user.roleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro por ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('documents:upload')
  @ApiOperation({ summary: 'Crear un nuevo registro' })
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('documents:upload')
  @ApiOperation({ summary: 'Actualizar un registro' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateDocumentDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('documents:delete')
  @ApiOperation({ summary: 'Eliminar un registro' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
