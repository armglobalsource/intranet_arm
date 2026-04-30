import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: number, roleId: number) {
    // TODO: aplicar filtros según rol y permisos
    return this.prisma.notification.findMany();
  }

  async findOne(id: number) {
    const item = await this.prisma.notification.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Notification con id ${id} no encontrado`);
    return item;
  }

  create(dto: CreateNotificationDto, userId: number) {
    return this.prisma.notification.create({ data: { ...dto } as any });
  }

  async update(id: number, dto: Partial<CreateNotificationDto>) {
    await this.findOne(id);
    return this.prisma.notification.update({ where: { id }, data: dto as any });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.notification.delete({ where: { id } });
  }
}
