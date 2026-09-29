import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe, DefaultValuePipe, UseGuards,
  UseInterceptors, UploadedFile, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ApproveUserDto } from './dto/create-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { hasPermission } from '../common/permissions';

// Sin users:edit, nadie puede tocar estos campos (ni siquiera sobre sí mismo).
const ADMIN_ONLY_FIELDS = ['roleId', 'status', 'jobTitleIds', 'ministerialTitle'];
// Lo que el organigrama (orgchart:edit) puede editar de otras personas.
const ORGCHART_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'country', 'campusId'];

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios paginados (con búsqueda opcional)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.service.findAll(user.sub, user.roleId, search, page, limit);
  }

  @Get('birthdays')
  @ApiOperation({ summary: 'Lista liviana (id, nombre, avatar, fecha de nacimiento) de usuarios activos con cumpleaños registrado, para el calendario' })
  findBirthdays() {
    return this.service.findBirthdays();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    const perms: string[] = user.permissions ?? [];
    if (!hasPermission(perms, 'users:create')) {
      // El organigrama puede dar de alta personas, pero solo con el rol básico.
      if (!hasPermission(perms, 'orgchart:edit') || !(await this.service.isBasicRole(dto.roleId))) {
        throw new ForbiddenException('No tienes permiso para crear esta persona');
      }
    }
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un usuario (incluye status)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    const perms: string[] = user.permissions ?? [];
    if (hasPermission(perms, 'users:edit')) return this.service.update(id, dto);

    const fields = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined);
    if (Number(user.sub) === id) {
      const blocked = fields.filter((f) => ADMIN_ONLY_FIELDS.includes(f));
      if (blocked.length) throw new ForbiddenException(`No puedes modificar: ${blocked.join(', ')}`);
      return this.service.update(id, dto);
    }
    if (hasPermission(perms, 'orgchart:edit') && fields.every((f) => ORGCHART_FIELDS.includes(f))) {
      return this.service.update(id, dto);
    }
    throw new ForbiddenException('No tienes permiso para modificar a esta persona');
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('users:delete')
  @ApiOperation({ summary: 'Eliminar un usuario' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Patch(':id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermission('users:edit')
  @ApiOperation({ summary: 'Aprobar un registro pendiente (opcionalmente asignando un rol)' })
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveUserDto) {
    return this.service.approve(id, dto?.roleId);
  }

  @Patch(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('users:edit')
  @ApiOperation({ summary: 'Rechazar un registro pendiente' })
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.service.reject(id);
  }

  @Post(':id/avatar')
  @ApiOperation({ summary: 'Subir foto de perfil de un usuario (máx 10 MB)' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (Number(user.sub) !== id && !hasPermission(user.permissions ?? [], 'users:edit')) {
      throw new ForbiddenException('Solo puedes cambiar tu propia foto');
    }
    return this.service.uploadAvatar(id, file);
  }
}
