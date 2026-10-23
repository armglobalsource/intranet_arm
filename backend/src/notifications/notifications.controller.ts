import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostgresNotificationsService } from './postgres-notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly service: PostgresNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis notificaciones' })
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un registro por ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.findOneForUser(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo registro' })
  create(@Body() dto: CreateNotificationDto, @CurrentUser() user: any) {
    const safeDto = this.isAdmin(user) ? dto : { ...dto, userId: user.sub };
    return this.service.create(safeDto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un registro' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateNotificationDto>,
    @CurrentUser() user: any,
  ) {
    if (!this.isAdmin(user)) throw new ForbiddenException();
    return this.service.update(id, dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.markRead(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    if (!this.isAdmin(user)) throw new ForbiddenException();
    return this.service.remove(id);
  }

  private isAdmin(user: any) {
    return (user.permissions ?? []).includes('*');
  }
}
