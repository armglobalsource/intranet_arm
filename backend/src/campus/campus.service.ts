import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCampusDto, UpdateCampusDto } from './dto/campus.dto';

@Injectable()
export class CampusService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.campus.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  findActive() {
    return this.prisma.campus.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
      select:  { id: true, name: true, address: true },
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.campus.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Campus con id ${id} no encontrado`);
    return item;
  }

  async create(dto: CreateCampusDto) {
    const existing = await this.prisma.campus.findFirst({
      where: { name: { equals: dto.name.trim(), mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException(`Ya existe un campus con el nombre "${dto.name}"`);
    return this.prisma.campus.create({ data: { name: dto.name.trim(), address: dto.address?.trim() } });
  }

  async update(id: number, dto: UpdateCampusDto) {
    await this.prisma.campus.findUniqueOrThrow({ where: { id } });
    if (dto.name) {
      const conflict = await this.prisma.campus.findFirst({
        where: { name: { equals: dto.name.trim(), mode: 'insensitive' }, id: { not: id } },
      });
      if (conflict) throw new ConflictException(`Ya existe un campus con el nombre "${dto.name}"`);
    }
    return this.prisma.campus.update({
      where: { id },
      data:  { ...dto, name: dto.name?.trim(), address: dto.address?.trim() },
    });
  }

  async remove(id: number) {
    await this.prisma.campus.findUniqueOrThrow({ where: { id } });
    return this.prisma.campus.delete({ where: { id } });
  }
}
