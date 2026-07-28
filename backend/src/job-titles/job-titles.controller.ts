import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JobTitlesService } from './job-titles.service';
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto';

@ApiTags('JobTitles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'job-titles', version: '1' })
export class JobTitlesController {
  constructor(private readonly service: JobTitlesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los cargos (admin)' })
  findAll() {
    return this.service.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Listar nombres de cargos activos (para combobox)' })
  findActive() {
    return this.service.findActive();
  }

  @Get(':id/affected-users')
  @ApiOperation({ summary: 'Personas afectadas por este cargo (para advertir antes de editar/eliminar)' })
  getAffectedUsers(@Param('id', ParseIntPipe) id: number) {
    return this.service.getAffectedUsers(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('directory:manage')
  @ApiOperation({ summary: 'Crear un nuevo cargo' })
  create(@Body() dto: CreateJobTitleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('directory:manage')
  @ApiOperation({ summary: 'Actualizar un cargo (nombre, estado, orden)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateJobTitleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('directory:manage')
  @ApiOperation({ summary: 'Eliminar un cargo' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
