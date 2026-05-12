import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto';

@Injectable()
export class JobTitlesService {
  constructor(private prisma: PrismaService) {}

  // Todos los cargos (admin — incluye inactivos)
  findAll() {
    return this.prisma.jobTitle.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // Solo cargos activos (usado por el combobox)
  findActive(): Promise<string[]> {
    return this.prisma.jobTitle
      .findMany({
        where:   { isActive: true },
        select:  { name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map((r) => r.name));
  }

  async create(dto: CreateJobTitleDto) {
    const existing = await this.prisma.jobTitle.findUnique({ where: { name: dto.name.trim() } });
    if (existing) throw new ConflictException(`Ya existe el cargo "${dto.name}"`);
    return this.prisma.jobTitle.create({ data: { name: dto.name.trim(), sortOrder: dto.sortOrder ?? 0 } });
  }

  async update(id: number, dto: UpdateJobTitleDto) {
    await this.prisma.jobTitle.findUniqueOrThrow({ where: { id } });
    if (dto.name) {
      const conflict = await this.prisma.jobTitle.findFirst({ where: { name: dto.name.trim(), id: { not: id } } });
      if (conflict) throw new ConflictException(`Ya existe el cargo "${dto.name}"`);
    }
    return this.prisma.jobTitle.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
  }

  async remove(id: number) {
    await this.prisma.jobTitle.findUniqueOrThrow({ where: { id } });
    return this.prisma.jobTitle.delete({ where: { id } });
  }
}
