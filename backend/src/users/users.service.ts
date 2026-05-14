import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

const JOB_TITLE_SELECT = { jobTitle: { select: { id: true, name: true } } };

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  phone: true,
  country: true,
  bio: true,
  status: true,
  departmentId: true,
  campusId: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true } },
  campus:     { select: { id: true, name: true, address: true } },
  role:       { select: { id: true, name: true } },
  jobTitles:  { select: JOB_TITLE_SELECT, orderBy: { sortOrder: 'asc' as const } },
} as const;

export interface PaginatedUsers {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    _userId: number,
    _roleId: number,
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedUsers> {
    const safeLimit = Math.min(limit, 200);
    const skip = (page - 1) * safeLimit;

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName:  { contains: search, mode: 'insensitive' as const } },
            { email:     { contains: search, mode: 'insensitive' as const } },
            { jobTitles: { some: { jobTitle: { name: { contains: search, mode: 'insensitive' as const } } } } },
          ],
        }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        select: USER_SELECT,
        where,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip,
        take: safeLimit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(id: number) {
    const item = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!item) throw new NotFoundException(`User con id ${id} no encontrado`);
    return item;
  }

  async create(dto: CreateUserDto, userId: number) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese email');

    const { password, jobTitleIds, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 12);

    return this.prisma.user.create({
      data: {
        ...rest,
        passwordHash,
        jobTitles: jobTitleIds?.length
          ? { create: jobTitleIds.map((jobTitleId, i) => ({ jobTitleId, sortOrder: i })) }
          : undefined,
      },
      select: USER_SELECT,
    });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const { jobTitleIds, password, email, ...rest } = dto;

    // Verificar unicidad del email si se está cambiando
    if (email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    return this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(email        ? { email }        : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(jobTitleIds !== undefined
          ? {
              jobTitles: {
                deleteMany: {},
                create: jobTitleIds.map((jobTitleId, i) => ({ jobTitleId, sortOrder: i })),
              },
            }
          : {}),
      },
      select: USER_SELECT,
    });
  }

  async remove(id: number) {
    await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return this.prisma.user.delete({ where: { id } });
  }

  findAllRoles() {
    return this.prisma.role.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { id: 'asc' },
    });
  }
}
