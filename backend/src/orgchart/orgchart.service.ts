import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import {
  CreateOrgAreaDto, UpdateOrgAreaDto,
  CreateOrgTeamDto, UpdateOrgTeamDto,
  CreateOrgMembershipDto, UpdateOrgMembershipDto,
} from './dto/create-orgchart.dto';

const USER_SELECT = {
  id: true, firstName: true, lastName: true,
  email: true, avatarUrl: true,
  phone: true, country: true, bio: true, status: true,
  campus: { select: { id: true, name: true } },
  jobTitles: { select: { jobTitle: { select: { name: true } } }, orderBy: { sortOrder: 'asc' as const } },
};

@Injectable()
export class OrgChartService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ── ÁREAS ────────────────────────────────────────────────────

  getAreas() {
    return this.prisma.orgArea.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  getAllAreas() {
    return this.prisma.orgArea.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async getAreaTree(slug: string) {
    const area = await this.prisma.orgArea.findUnique({ where: { slug } });
    if (!area) throw new NotFoundException(`Área '${slug}' no encontrada`);

    const [leaders, teams] = await Promise.all([
      this.prisma.orgMembership.findMany({
        where: { areaId: area.id, role: 'area_leader' },
        include: { user: { select: USER_SELECT } },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.orgTeam.findMany({
        where: { areaId: area.id, isActive: true },
        orderBy: [{ colPosition: 'asc' }, { sortOrder: 'asc' }],
        include: {
          memberships: {
            include: { user: { select: USER_SELECT } },
            orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }],
          },
        },
      }),
    ]);

    return { ...area, leaders, teams };
  }

  async createArea(dto: CreateOrgAreaDto) {
    return this.prisma.orgArea.create({ data: dto as any });
  }

  async updateArea(id: number, dto: UpdateOrgAreaDto) {
    await this.findAreaOrFail(id);
    return this.prisma.orgArea.update({ where: { id }, data: dto });
  }

  async deleteArea(id: number) {
    await this.findAreaOrFail(id);
    await this.prisma.orgTeam.updateMany({ where: { areaId: id }, data: { isActive: false } });
    return this.prisma.orgArea.update({ where: { id }, data: { isActive: false } });
  }

  // ── EQUIPOS ──────────────────────────────────────────────────

  getTeams() {
    return this.prisma.orgTeam.findMany({
      where: { isActive: true },
      include: { area: true },
      orderBy: [{ areaId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  getAllTeams() {
    return this.prisma.orgTeam.findMany({
      include: { area: true },
      orderBy: [{ isActive: 'desc' }, { areaId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createTeam(dto: CreateOrgTeamDto) {
    await this.findAreaOrFail(dto.areaId);
    return this.prisma.orgTeam.create({ data: dto as any });
  }

  async updateTeam(id: number, dto: UpdateOrgTeamDto) {
    await this.findTeamOrFail(id);
    return this.prisma.orgTeam.update({ where: { id }, data: dto });
  }

  async deleteTeam(id: number) {
    await this.findTeamOrFail(id);
    return this.prisma.orgTeam.update({ where: { id }, data: { isActive: false } });
  }

  async uploadTeamLogo(id: number, file: Express.Multer.File) {
    await this.findTeamOrFail(id);
    const ext = file.originalname.split('.').pop() ?? 'png';
    const key = `team-logos/${id}-${Date.now()}.${ext}`;
    await this.storage.uploadAvatar(key, file.buffer, file.mimetype);
    const iconUrl = await this.storage.getPresignedUrl('avatars', key, 60 * 60 * 24 * 365);
    return this.prisma.orgTeam.update({ where: { id }, data: { iconUrl } });
  }

  // ── MEMBRESÍAS ───────────────────────────────────────────────

  async createMembership(dto: CreateOrgMembershipDto) {
    if (!dto.areaId && !dto.teamId) {
      throw new BadRequestException('Debe indicar areaId o teamId');
    }
    if (dto.areaId && dto.teamId) {
      throw new BadRequestException('Solo puede indicar areaId o teamId, no ambos');
    }
    if (dto.areaId && dto.role !== 'area_leader') {
      throw new BadRequestException('Las membresías de área solo pueden tener rol area_leader');
    }
    return this.prisma.orgMembership.create({
      data: dto as any,
      include: { user: { select: USER_SELECT } },
    });
  }

  async updateMembership(id: number, dto: UpdateOrgMembershipDto) {
    const m = await this.prisma.orgMembership.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`Membresía ${id} no encontrada`);
    return this.prisma.orgMembership.update({ where: { id }, data: dto });
  }

  async deleteMembership(id: number) {
    const m = await this.prisma.orgMembership.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`Membresía ${id} no encontrada`);
    return this.prisma.orgMembership.delete({ where: { id } });
  }

  // ── BÚSQUEDA ─────────────────────────────────────────────────

  async search(q: string) {
    if (!q || q.trim().length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        status: 'active',
        OR: [
          { firstName: { contains: q.trim(), mode: 'insensitive' } },
          { lastName:  { contains: q.trim(), mode: 'insensitive' } },
          { jobTitles: { some: { jobTitle: { name: { contains: q.trim(), mode: 'insensitive' } } } } },
        ],
        orgMemberships: { some: {} },
      },
      select: {
        ...USER_SELECT,
        orgMemberships: {
          include: {
            area: { select: { id: true, name: true, color: true, slug: true } },
            team: { select: { id: true, name: true } },
          },
        },
      },
      take: 40,
    });
  }

  // ── HELPERS ──────────────────────────────────────────────────

  private async findAreaOrFail(id: number) {
    const a = await this.prisma.orgArea.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Área ${id} no encontrada`);
    return a;
  }

  private async findTeamOrFail(id: number) {
    const t = await this.prisma.orgTeam.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(`Equipo ${id} no encontrado`);
    return t;
  }
}
