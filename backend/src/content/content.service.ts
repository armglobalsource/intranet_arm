import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';

@Injectable()
export class ContentsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: number, roleId: number) {
    // TODO: aplicar filtros según rol y permisos
    return this.prisma.content.findMany();
  }

  async findOne(id: number) {
    const item = await this.prisma.content.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Content con id ${id} no encontrado`);
    return item;
  }

  create(dto: CreateContentDto, userId: number) {
    return this.prisma.content.create({ data: { ...dto } as any });
  }

  async update(id: number, dto: Partial<CreateContentDto>) {
    await this.findOne(id);
    return this.prisma.content.update({ where: { id }, data: dto as any });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.content.delete({ where: { id } });
  }
}
