import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseIntPipe, UseGuards,
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

  @Get()
  @ApiOperation({ summary: 'Listar todos los registros' })
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.sub, user.roleId);
  }

  /** Noticias globales publicadas (campusId == null) */
  @Get('news/global')
  @ApiOperation({ summary: 'Noticias globales publicadas' })
  findGlobal() {
    return this.service.findPublished('global');
  }

  /** Noticias del campus del usuario autenticado */
  @Get('news/campus')
  @ApiOperation({ summary: 'Noticias del campus del usuario' })
  findCampus(@CurrentUser() user: any) {
    const campusId = user?.campusId ? String(user.campusId) : undefined;
    return this.service.findPublished('campus', campusId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo registro' })
  create(@Body() dto: CreateContentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateContentDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
