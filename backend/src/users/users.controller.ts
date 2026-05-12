import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Listar roles disponibles' })
  findAllRoles() {
    return this.service.findAllRoles();
  }

  @Get('job-titles')
  @ApiOperation({ summary: 'Listar cargos únicos existentes' })
  findAllJobTitles() {
    return this.service.findAllJobTitles();
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios (con búsqueda opcional)' })
  @ApiQuery({ name: 'search', required: false, description: 'Filtrar por nombre, apellido, email o cargo' })
  findAll(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.service.findAll(user.sub, user.roleId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un usuario (incluye status)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un usuario' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
