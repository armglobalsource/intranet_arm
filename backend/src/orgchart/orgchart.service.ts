import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateOrgAreaDto, CreateOrgNodeDto, UpdateOrgNodeDto, UpdateOrgAreaDto } from './dto/create-orgchart.dto';

// Campos de usuario que se exponen en el organigrama (sin datos sensibles)
const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  jobTitle: true,
  phone: true,
  country: true,
};

@Injectable()
export class OrgChartService {
  constructor(private prisma: PrismaService) {}

  getAreas() {
    return this.prisma.orgArea.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAreaTree(slug: string) {
    const area = await this.prisma.orgArea.findUnique({ where: { slug } });
    if (!area) throw new NotFoundException(`Area '${slug}' not found`);

    const nodes = await this.prisma.orgNode.findMany({
      where: { areaId: area.id, isActive: true },
      include: { user: { select: USER_SELECT } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return { ...area, nodes: this.buildTree(nodes, null) };
  }

  async searchNodes(q: string) {
    if (!q || q.trim().length < 2) return [];

    return this.prisma.orgNode.findMany({
      where: {
        isActive: true,
        type: { not: 'group' },
        name: { contains: q.trim(), mode: 'insensitive' },
      },
      include: {
        area: true,
        parent: { select: { name: true, type: true } },
        user: { select: USER_SELECT },
      },
      orderBy: { name: 'asc' },
      take: 40,
    });
  }

  async linkUser(nodeId: number, userId: number | null) {
    const node = await this.prisma.orgNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException(`Node ${nodeId} not found`);

    if (userId !== null) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException(`User ${userId} not found`);
    }

    return this.prisma.orgNode.update({
      where: { id: nodeId },
      data: { userId },
      include: { user: { select: USER_SELECT } },
    });
  }

  async createArea(dto: CreateOrgAreaDto) {
    return this.prisma.orgArea.create({ data: dto as any });
  }

  async updateArea(id: number, dto: UpdateOrgAreaDto) {
    const area = await this.prisma.orgArea.findUnique({ where: { id } });
    if (!area) throw new NotFoundException(`Area ${id} not found`);
    return this.prisma.orgArea.update({ where: { id }, data: dto });
  }

  async createNode(dto: CreateOrgNodeDto) {
    return this.prisma.orgNode.create({ data: dto as any });
  }

  async updateNode(id: number, dto: UpdateOrgNodeDto) {
    const node = await this.prisma.orgNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException(`Node ${id} not found`);
    return this.prisma.orgNode.update({ where: { id }, data: dto });
  }

  async removeNode(id: number) {
    const node = await this.prisma.orgNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException(`Node ${id} not found`);
    return this.prisma.orgNode.update({ where: { id }, data: { isActive: false } });
  }

  private buildTree(nodes: any[], parentId: number | null): any[] {
    return nodes
      .filter((n) => n.parentId === parentId)
      .map((n) => ({ ...n, children: this.buildTree(nodes, n.id) }));
  }
}
