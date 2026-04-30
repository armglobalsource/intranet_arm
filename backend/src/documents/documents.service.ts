import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: number, roleId: number) {
    // TODO: aplicar filtros según rol y permisos
    return this.prisma.document.findMany();
  }

  async findOne(id: number) {
    const item = await this.prisma.document.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Document con id ${id} no encontrado`);
    return item;
  }

  create(dto: CreateDocumentDto, userId: number) {
    return this.prisma.document.create({ data: { ...dto } as any });
  }

  async update(id: number, dto: Partial<CreateDocumentDto>) {
    await this.findOne(id);
    return this.prisma.document.update({ where: { id }, data: dto as any });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.document.delete({ where: { id } });
  }
}
