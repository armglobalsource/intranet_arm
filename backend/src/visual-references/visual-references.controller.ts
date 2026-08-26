import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { VisualReferencesService } from './visual-references.service';
import { CreateVisualReferenceDto, UpdateVisualReferenceDto } from './dto/visual-reference.dto';

@ApiTags('VisualReferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'visual-references', version: '1' })
export class VisualReferencesController {
  constructor(private readonly service: VisualReferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar referencias visuales (con búsqueda opcional por nombre/tag)' })
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una referencia visual' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('visual-references:manage')
  @ApiOperation({ summary: 'Subir nueva referencia visual (imagen)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  }))
  create(
    @Body() dto: CreateVisualReferenceDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.service.create(dto, file, user.sub, user.name ?? user.email);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('visual-references:manage')
  @ApiOperation({ summary: 'Actualizar nombre, tags o estado de una referencia' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVisualReferenceDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('visual-references:manage')
  @ApiOperation({ summary: 'Eliminar una referencia visual (imagen incluida)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
