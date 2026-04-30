import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  phone: true,
  country: true,
  jobTitle: true,
  bio: true,
  status: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true } },
  role: { select: { id: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: number, roleId: number, search?: string) {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName:  { contains: search, mode: 'insensitive' } },
              { email:     { contains: search, mode: 'insensitive' } },
              { jobTitle:  { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!item) throw new NotFoundException(`User con id ${id} no encontrado`);
    return item;
  }

  create(dto: CreateUserDto, userId: number) {
    return this.prisma.user.create({ data: { ...dto } as any });
  }

  async update(id: number, dto: Partial<CreateUserDto>) {
    await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return this.prisma.user.update({
      where: { id },
      data: dto as any,
      select: USER_SELECT,
    });
  }

  async remove(id: number) {
    await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return this.prisma.user.delete({ where: { id } });
  }
}
