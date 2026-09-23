import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { StorageService } from '../common/storage/storage.service';
import { JobTitlesService } from '../job-titles/job-titles.service';
import {
  CreateOrgAreaDto, UpdateOrgAreaDto,
  CreateOrgTeamDto, UpdateOrgTeamDto,
  CreateOrgMembershipDto, UpdateOrgMembershipDto,
} from './dto/create-orgchart.dto';

const AREAS = 'org_areas';
const TEAMS = 'org_teams';
const MEMBERSHIPS = 'org_memberships';

/** Formatea un usuario de Firestore al shape esperado por el frontend */
function fmtUser(u: any) {
  if (!u) return null;
  const { passwordHash, nameLower, ...rest } = u;
  const jobTitles = (u.jobTitles ?? []).map((jt: any) => ({
    jobTitle: { id: jt.jobTitleId, name: jt.name },
  }));
  return { ...rest, jobTitles };
}

@Injectable()
export class OrgChartService {
  constructor(
    private fb: FirebaseService,
    private storage: StorageService,
    private jobTitles: JobTitlesService,
  ) {}

  // ── ÁREAS ─────────────────────────────────────────────────────────────────

  async getAreas() {
    const snap = await this.fb.db.collection(AREAS).where('isActive', '==', true).get();
    return this.fb.toDocs(snap).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getAllAreas() {
    const snap = await this.fb.db.collection(AREAS).get();
    return this.fb.toDocs(snap)
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
        return a.sortOrder - b.sortOrder;
      });
  }

  async getAreaTree(slug: string) {
    const areaSnap = await this.fb.db.collection(AREAS).where('slug', '==', slug).limit(1).get();
    if (areaSnap.empty) throw new NotFoundException(`Área '${slug}' no encontrada`);
    const area = this.fb.toObj(areaSnap.docs[0]);

    const [allMembSnap, teamsSnap] = await Promise.all([
      this.fb.db.collection(MEMBERSHIPS).where('areaId', '==', area.id).get(),
      this.fb.db.collection(TEAMS).where('areaId', '==', area.id).get(),
    ]);

    const leaders = this.fb.toDocs(allMembSnap)
      .filter((m) => m.role === 'area_leader')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const teams = this.fb.toDocs(teamsSnap)
      .filter((t) => t.isActive)
      .sort((a, b) => a.colPosition - b.colPosition || a.sortOrder - b.sortOrder);

    const teamIds = new Set(teams.map((t) => t.id));

    // Membresías de los equipos de esta área
    const teamMembSnaps = await Promise.all(
      teams.map((t) => this.fb.db.collection(MEMBERSHIPS).where('teamId', '==', t.id).get()),
    );
    const allTeamMembers = teamMembSnaps.flatMap((s) => this.fb.toDocs(s))
      .filter((m) => teamIds.has(m.teamId));

    // Cargar usuarios de todas las membresías
    const userIds = new Set([
      ...leaders.map((m) => m.userId),
      ...allTeamMembers.map((m) => m.userId),
    ]);
    const usersMap = await this.loadUsersMap(Array.from(userIds));

    const jobTitleIds = [...new Set(
      [...leaders, ...allTeamMembers].map((m) => m.jobTitleId).filter((v): v is number => v != null),
    )];
    const jobTitlesMap = await this.loadMap('job_titles', jobTitleIds);
    const jobTitleOf = (m: any) => (m.jobTitleId != null && jobTitlesMap[m.jobTitleId])
      ? { id: jobTitlesMap[m.jobTitleId].id, name: jobTitlesMap[m.jobTitleId].name }
      : null;

    const formattedLeaders = leaders
      .map((m) => ({
        ...m,
        area: { id: area.id, name: area.name, color: area.color, slug: area.slug, icon: area.icon },
        team: null,
        jobTitle: jobTitleOf(m),
        user: fmtUser(usersMap[m.userId]),
      }))
      // Ignorar membresías cuyo usuario fue eliminado
      .filter((m) => m.user !== null);

    const teamsWithMembers = teams.map((team) => ({
      ...team,
      memberships: allTeamMembers
        .filter((m) => m.teamId === team.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => ({
          ...m,
          area: null,
          team: { id: team.id, name: team.name, area: { id: area.id, name: area.name, color: area.color, slug: area.slug, icon: area.icon } },
          jobTitle: jobTitleOf(m),
          user: fmtUser(usersMap[m.userId]),
        }))
        .filter((m) => m.user !== null),
    }));

    // Construir árbol recursivo: los equipos raíz son los que no tienen parentTeamId
    const buildTeamTree = (parentId: number | null): typeof teamsWithMembers =>
      teamsWithMembers
        .filter((t) => (t.parentTeamId ?? null) === parentId)
        .map((t) => ({ ...t, children: buildTeamTree(t.id) }));

    const teamTree = buildTeamTree(null);

    return { ...area, leaders: formattedLeaders, teams: teamTree };
  }

  async createArea(dto: CreateOrgAreaDto) {
    const id = await this.fb.nextId(AREAS);
    const doc = { id, ...dto, isActive: true, createdAt: this.fb.now(), updatedAt: this.fb.now() };
    await this.fb.db.collection(AREAS).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(AREAS).doc(String(id)).get());
  }

  async updateArea(id: number, dto: UpdateOrgAreaDto) {
    await this.findAreaOrFail(id);
    await this.fb.db.collection(AREAS).doc(String(id)).update({ ...dto, updatedAt: this.fb.now() });
    return this.fb.toObj(await this.fb.db.collection(AREAS).doc(String(id)).get());
  }

  async deleteArea(id: number) {
    await this.findAreaOrFail(id);

    const [teamsSnap, areaMembSnap] = await Promise.all([
      this.fb.db.collection(TEAMS).where('areaId', '==', id).get(),
      this.fb.db.collection(MEMBERSHIPS).where('areaId', '==', id).get(),
    ]);

    const teamIds = teamsSnap.docs.map((d) => d.data().id as number);

    // Membresías de los equipos del área
    const teamMembSnaps = teamIds.length
      ? await Promise.all(teamIds.map((tid) => this.fb.db.collection(MEMBERSHIPS).where('teamId', '==', tid).get()))
      : [];
    const teamMembDocs = teamMembSnaps.flatMap((s) => s.docs);

    // Eliminar en lotes de 500 (límite de Firestore)
    const allDocs = [
      ...areaMembSnap.docs,
      ...teamMembDocs,
      ...teamsSnap.docs,
      this.fb.db.collection(AREAS).doc(String(id)),
    ];

    const BATCH_LIMIT = 500;
    for (let i = 0; i < allDocs.length; i += BATCH_LIMIT) {
      const batch = this.fb.db.batch();
      allDocs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete('ref' in d ? (d as any).ref : d));
      await batch.commit();
    }

    return { id, deleted: true };
  }

  async uploadAreaLogo(id: number, file: Express.Multer.File) {
    await this.findAreaOrFail(id);
    const ext     = (file.originalname.split('.').pop() ?? 'webp').toLowerCase();
    const key     = `area-logos/${id}-${Date.now()}.${ext}`;
    const iconUrl = await this.storage.uploadPublic(key, file.buffer, file.mimetype);
    await this.fb.db.collection(AREAS).doc(String(id)).update({ iconUrl, updatedAt: this.fb.now() });
    return this.fb.toObj(await this.fb.db.collection(AREAS).doc(String(id)).get());
  }

  // ── EQUIPOS ───────────────────────────────────────────────────────────────

  async getTeams() {
    const [teamsSnap, areasSnap] = await Promise.all([
      this.fb.db.collection(TEAMS).where('isActive', '==', true).get(),
      this.fb.db.collection(AREAS).get(),
    ]);
    const areasMap = Object.fromEntries(this.fb.toDocs(areasSnap).map((a) => [a.id, a]));
    return this.fb.toDocs(teamsSnap)
      .sort((a, b) => a.areaId - b.areaId || a.sortOrder - b.sortOrder)
      .map((t) => ({ ...t, area: areasMap[t.areaId] ?? null }));
  }

  async getAllTeams() {
    const [teamsSnap, areasSnap, membSnap] = await Promise.all([
      this.fb.db.collection(TEAMS).get(),
      this.fb.db.collection(AREAS).get(),
      this.fb.db.collection(MEMBERSHIPS).get(),
    ]);
    const areasMap = Object.fromEntries(this.fb.toDocs(areasSnap).map((a) => [a.id, a]));

    // Contar miembros por equipo
    const memberCountMap: Record<number, number> = {};
    this.fb.toDocs(membSnap).forEach((m) => {
      if (m.teamId) memberCountMap[m.teamId] = (memberCountMap[m.teamId] ?? 0) + 1;
    });

    return this.fb.toDocs(teamsSnap)
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
        return a.areaId - b.areaId || a.sortOrder - b.sortOrder;
      })
      .map((t) => ({ ...t, area: areasMap[t.areaId] ?? null, memberCount: memberCountMap[t.id] ?? 0 }));
  }

  async createTeam(dto: CreateOrgTeamDto) {
    await this.findAreaOrFail(dto.areaId);
    if (dto.parentTeamId) await this.findTeamOrFail(dto.parentTeamId);
    const id  = await this.fb.nextId(TEAMS);
    const doc = {
      id,
      ...dto,
      parentTeamId: dto.parentTeamId ?? null,
      isActive: true,
      iconUrl: null,
      createdAt: this.fb.now(),
      updatedAt: this.fb.now(),
    };
    await this.fb.db.collection(TEAMS).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(TEAMS).doc(String(id)).get());
  }

  async updateTeam(id: number, dto: UpdateOrgTeamDto) {
    await this.findTeamOrFail(id);
    await this.fb.db.collection(TEAMS).doc(String(id)).update({ ...dto, updatedAt: this.fb.now() });
    return this.fb.toObj(await this.fb.db.collection(TEAMS).doc(String(id)).get());
  }

  async deleteTeam(id: number) {
    await this.findTeamOrFail(id);
    await this.fb.db.collection(TEAMS).doc(String(id)).update({ isActive: false, updatedAt: this.fb.now() });
    return this.fb.toObj(await this.fb.db.collection(TEAMS).doc(String(id)).get());
  }

  async uploadTeamLogo(id: number, file: Express.Multer.File) {
    await this.findTeamOrFail(id);
    const ext     = (file.originalname.split('.').pop() ?? 'png').toLowerCase();
    const key     = `team-logos/${id}-${Date.now()}.${ext}`;
    const iconUrl = await this.storage.uploadPublic(key, file.buffer, file.mimetype);
    await this.fb.db.collection(TEAMS).doc(String(id)).update({ iconUrl, updatedAt: this.fb.now() });
    return this.fb.toObj(await this.fb.db.collection(TEAMS).doc(String(id)).get());
  }

  // ── MEMBRESÍAS ────────────────────────────────────────────────────────────

  async createMembership(dto: CreateOrgMembershipDto) {
    if (!dto.areaId && !dto.teamId) throw new BadRequestException('Debe indicar areaId o teamId');
    if (dto.areaId && dto.teamId)   throw new BadRequestException('Solo puede indicar areaId o teamId, no ambos');
    if (dto.areaId && dto.role !== 'area_leader') throw new BadRequestException('Las membresías de área solo pueden tener rol area_leader');
    if (dto.jobTitleId != null) await this.jobTitles.findOne(dto.jobTitleId);

    const id  = await this.fb.nextId(MEMBERSHIPS);
    const doc = {
      id,
      userId:      dto.userId,
      areaId:      dto.areaId  ?? null,
      teamId:      dto.teamId  ?? null,
      role:        dto.role,
      jobTitleId:  dto.jobTitleId ?? null,
      sortOrder:   dto.sortOrder ?? 0,
      createdAt:   this.fb.now(),
      updatedAt:   this.fb.now(),
    };
    await this.fb.db.collection(MEMBERSHIPS).doc(String(id)).set(doc);
    return this.attachJobTitle(this.fb.toObj(await this.fb.db.collection(MEMBERSHIPS).doc(String(id)).get()));
  }

  async updateMembership(id: number, dto: UpdateOrgMembershipDto) {
    const snap = await this.fb.db.collection(MEMBERSHIPS).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Membresía ${id} no encontrada`);
    if (dto.jobTitleId != null) await this.jobTitles.findOne(dto.jobTitleId);
    await this.fb.db.collection(MEMBERSHIPS).doc(String(id)).update({ ...dto, updatedAt: this.fb.now() });
    return this.attachJobTitle(this.fb.toObj(await this.fb.db.collection(MEMBERSHIPS).doc(String(id)).get()));
  }

  async deleteMembership(id: number) {
    const snap = await this.fb.db.collection(MEMBERSHIPS).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Membresía ${id} no encontrada`);
    await this.fb.db.collection(MEMBERSHIPS).doc(String(id)).delete();
    return { id };
  }

  // ── PERFIL USUARIO ────────────────────────────────────────────────────────

  async getUserOrgProfile(userId: number) {
    const userSnap = await this.fb.db.collection('users').doc(String(userId)).get();
    if (!userSnap.exists) throw new NotFoundException(`Usuario ${userId} no encontrado`);
    const user = fmtUser(this.fb.toObj(userSnap));

    const membSnap = await this.fb.db.collection(MEMBERSHIPS).where('userId', '==', userId).get();
    const memberships = this.fb.toDocs(membSnap).sort((a, b) => a.sortOrder - b.sortOrder);

    const directAreaIds = memberships.map((m) => m.areaId).filter(Boolean);
    const teamIds = [...new Set(memberships.map((m) => m.teamId).filter(Boolean))];

    // Load teams first so we can collect their areaIds too
    const teamsMap = await this.loadMap(TEAMS, teamIds);
    const teamAreaIds = Object.values(teamsMap).map((t: any) => t.areaId).filter(Boolean);
    const allAreaIds = [...new Set([...directAreaIds, ...teamAreaIds])];
    const areasMap = await this.loadMap(AREAS, allAreaIds);

    const jobTitleIds = [...new Set(memberships.map((m) => m.jobTitleId).filter((v): v is number => v != null))];
    const jobTitlesMap = await this.loadMap('job_titles', jobTitleIds);
    const jobTitleOf = (m: any) => (m.jobTitleId != null && jobTitlesMap[m.jobTitleId])
      ? { id: jobTitlesMap[m.jobTitleId].id, name: jobTitlesMap[m.jobTitleId].name }
      : null;

    const orgMemberships = memberships.map((m) => {
      const team = m.teamId ? teamsMap[m.teamId] : null;
      const teamArea = team ? areasMap[team.areaId] : null;
      return {
        ...m,
        area: m.areaId ? areasMap[m.areaId] : null,
        team: team ? { id: team.id, name: team.name, area: teamArea ? { id: teamArea.id, name: teamArea.name, color: teamArea.color, slug: teamArea.slug, icon: teamArea.icon } : null } : null,
        jobTitle: jobTitleOf(m),
      };
    });

    return { ...user, orgMemberships };
  }

  /**
   * Categoriza a cada usuario con membresía en el organigrama según el área
   * de su equipo (o de su membresía directa si es líder de área): 'worship'
   * para el área con slug 'worship', 'tecnico' para el área con slug
   * 'produccion'. Si un usuario pertenece a ambas, gana 'worship'. Los
   * usuarios que no aparecen en el mapa no tienen ninguna de las dos áreas
   * (el llamador los trata como "ningún equipo").
   */
  async getUserAreaCategoryMap(): Promise<Record<number, 'worship' | 'tecnico'>> {
    const [membSnap, teamsSnap, areasSnap] = await Promise.all([
      this.fb.db.collection(MEMBERSHIPS).get(),
      this.fb.db.collection(TEAMS).get(),
      this.fb.db.collection(AREAS).get(),
    ]);

    const areas = this.fb.toDocs(areasSnap);
    const worshipAreaId    = areas.find((a) => a.slug === 'worship')?.id    ?? null;
    const produccionAreaId = areas.find((a) => a.slug === 'produccion')?.id ?? null;

    const teamAreaMap = new Map<number, number>();
    this.fb.toDocs(teamsSnap).forEach((t) => teamAreaMap.set(t.id, t.areaId));

    const areaIdsByUser = new Map<number, Set<number>>();
    for (const m of this.fb.toDocs(membSnap)) {
      const areaId = m.areaId ?? (m.teamId != null ? teamAreaMap.get(m.teamId) : undefined);
      if (areaId == null) continue;
      if (!areaIdsByUser.has(m.userId)) areaIdsByUser.set(m.userId, new Set());
      areaIdsByUser.get(m.userId)!.add(areaId);
    }

    const result: Record<number, 'worship' | 'tecnico'> = {};
    for (const [userId, areaIds] of areaIdsByUser) {
      if (worshipAreaId != null && areaIds.has(worshipAreaId)) {
        result[userId] = 'worship';
      } else if (produccionAreaId != null && areaIds.has(produccionAreaId)) {
        result[userId] = 'tecnico';
      }
    }
    return result;
  }

  async search(q: string) {
    if (!q || q.trim().length < 2) return [];
    const term = q.trim().toLowerCase();

    const membSnap = await this.fb.db.collection(MEMBERSHIPS).get();
    const memberships = this.fb.toDocs(membSnap);
    const userIdsWithMembership = new Set(memberships.map((m) => m.userId));

    const jobTitleIds = [...new Set(memberships.map((m) => m.jobTitleId).filter((v): v is number => v != null))];
    const jobTitlesMap = await this.loadMap('job_titles', jobTitleIds);
    const jobTitleOf = (m: any) => (m.jobTitleId != null && jobTitlesMap[m.jobTitleId])
      ? { id: jobTitlesMap[m.jobTitleId].id, name: jobTitlesMap[m.jobTitleId].name }
      : null;
    const jobTitleNamesByUser = new Map<number, string[]>();
    memberships.forEach((m) => {
      const jt = jobTitleOf(m);
      if (!jt) return;
      if (!jobTitleNamesByUser.has(m.userId)) jobTitleNamesByUser.set(m.userId, []);
      jobTitleNamesByUser.get(m.userId)!.push(jt.name);
    });

    const usersSnap = await this.fb.db.collection('users').where('status', '==', 'active').get();
    const matched = this.fb.toDocs(usersSnap)
      .filter((u) =>
        userIdsWithMembership.has(u.id) && (
          u.firstName?.toLowerCase().includes(term) ||
          u.lastName?.toLowerCase().includes(term)  ||
          (u.jobTitles ?? []).some((jt: any) => jt.name?.toLowerCase().includes(term)) ||
          (jobTitleNamesByUser.get(u.id) ?? []).some((name) => name.toLowerCase().includes(term))
        ),
      )
      .slice(0, 40);

    if (!matched.length) return [];

    const directAreaIds = memberships.map((m) => m.areaId).filter(Boolean);
    const teamIds = [...new Set(memberships.map((m) => m.teamId).filter(Boolean))];

    // Load teams first so we can also load their areas
    const teamsMap = await this.loadMap(TEAMS, teamIds);
    const teamAreaIds = Object.values(teamsMap).map((t: any) => t.areaId).filter(Boolean);
    const allAreaIds = [...new Set([...directAreaIds, ...teamAreaIds])];
    const areasMap = await this.loadMap(AREAS, allAreaIds);

    return matched.map((u) => ({
      ...fmtUser(u),
      orgMemberships: memberships
        .filter((m) => m.userId === u.id)
        .map((m) => {
          const team = m.teamId ? teamsMap[m.teamId] : null;
          const teamArea = team ? areasMap[team.areaId] : null;
          return {
            ...m,
            area: m.areaId ? areasMap[m.areaId] : null,
            team: team ? { id: team.id, name: team.name, area: teamArea ? { id: teamArea.id, name: teamArea.name, color: teamArea.color, slug: teamArea.slug, icon: teamArea.icon } : null } : null,
            jobTitle: jobTitleOf(m),
          };
        }),
    }));
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  private async attachJobTitle(m: any) {
    if (m.jobTitleId == null) return { ...m, jobTitle: null };
    const jt = await this.jobTitles.findOne(m.jobTitleId).catch(() => null);
    return { ...m, jobTitle: jt ? { id: jt.id, name: jt.name } : null };
  }

  private async findAreaOrFail(id: number) {
    const snap = await this.fb.db.collection(AREAS).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Área ${id} no encontrada`);
    return this.fb.toObj(snap);
  }

  private async findTeamOrFail(id: number) {
    const snap = await this.fb.db.collection(TEAMS).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Equipo ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  private async loadUsersMap(ids: number[]): Promise<Record<number, any>> {
    if (!ids.length) return {};
    const snaps = await Promise.all(ids.map((id) => this.fb.db.collection('users').doc(String(id)).get()));
    return Object.fromEntries(
      snaps.filter((s) => s.exists).map((s) => [s.data()!.id, this.fb.toObj(s)]),
    );
  }

  private async loadMap(col: string, ids: number[]): Promise<Record<number, any>> {
    if (!ids.length) return {};
    const snaps = await Promise.all(ids.map((id) => this.fb.db.collection(col).doc(String(id)).get()));
    return Object.fromEntries(
      snaps.filter((s) => s.exists).map((s) => [s.data()!.id, this.fb.toObj(s)]),
    );
  }
}
