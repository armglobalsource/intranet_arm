import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { CampusService } from '../campus/campus.service';
import { normalizeName, scoreNameMatch, parseChileanDate, splitFullName } from './matching.util';
import {
  ExcelRowDto, MatchResult, MatchCandidate, ApplyMatchDto, ApplyResult,
} from './dto/reconciliation.dto';

const SUGGEST_THRESHOLD = 0.95;
const TOP_N = 5;
/** Rol 'user' — con el que quedan las personas creadas desde esta herramienta. */
const DEFAULT_NEW_USER_ROLE_ID = 2;

const AREAS       = 'org_areas';
const TEAMS        = 'org_teams';
const MEMBERSHIPS = 'org_memberships';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly fb:      FirebaseService,
    private readonly users:   UsersService,
    private readonly campus:  CampusService,
  ) {}

  /**
   * Trae TODOS los usuarios sin el tope de 200 que aplica UsersService.findAll()
   * (paginación pensada para la UI, no para el matching, que necesita ver a todos
   * los candidatos — incluidos los recién creados por esta misma herramienta).
   */
  private async getAllUsersRaw(): Promise<any[]> {
    const snap = await this.fb.db.collection('users').get();
    return this.fb.toDocs(snap);
  }

  /** Área(s) actuales de cada usuario en el organigrama, para ayudar a confirmar identidad. */
  private async getAreaNamesByUserId(): Promise<Map<number, string>> {
    const [membSnap, teamsSnap, areasSnap] = await Promise.all([
      this.fb.db.collection(MEMBERSHIPS).get(),
      this.fb.db.collection(TEAMS).get(),
      this.fb.db.collection(AREAS).get(),
    ]);
    const areaNameById = new Map(this.fb.toDocs(areasSnap).map((a: any) => [a.id, a.name]));
    const teamAreaId    = new Map(this.fb.toDocs(teamsSnap).map((t: any) => [t.id, t.areaId]));

    const result = new Map<number, string[]>();
    this.fb.toDocs(membSnap).forEach((m: any) => {
      const areaId = m.areaId ?? (m.teamId ? teamAreaId.get(m.teamId) : null);
      const name   = areaId ? areaNameById.get(areaId) : null;
      if (!name) return;
      const list = result.get(m.userId) ?? [];
      if (!list.includes(name)) list.push(name);
      result.set(m.userId, list);
    });

    return new Map([...result.entries()].map(([userId, names]) => [userId, names.join(', ')]));
  }

  async match(rows: ExcelRowDto[]): Promise<MatchResult[]> {
    const allUsers = await this.getAllUsersRaw();
    const campuses = await this.campus.findAll();
    const areaByUserId = await this.getAreaNamesByUserId();

    return rows.map((row) => {
      const excelNorm = normalizeName(row.nombreCompleto);

      const scored: MatchCandidate[] = allUsers
        .map((u: any) => ({
          userId: u.id,
          name:   `${u.firstName} ${u.lastName}`,
          email:  u.email,
          score:  scoreNameMatch(excelNorm, normalizeName(`${u.firstName} ${u.lastName}`)),
          campus: u.campus?.name ?? null,
          area:   areaByUserId.get(u.id) ?? null,
        }))
        .sort((a, b) => b.score - a.score);

      const topCandidates = scored.slice(0, TOP_N);
      const best = topCandidates[0];
      const suggestedUserId = best && best.score >= SUGGEST_THRESHOLD ? best.userId : null;

      const resolvedCampusId = this.resolveCampus(row.campus, campuses);

      return {
        rowKey: row.rowKey,
        excelRow: {
          nombreCompleto:  row.nombreCompleto,
          area:            row.area,
          correo:          row.correo,
          fechaNacimiento: row.fechaNacimiento,
          campus:          row.campus,
        },
        parsedBirthDate: parseChileanDate(row.fechaNacimiento),
        resolvedCampusId,
        suggestedUserId,
        confidence: best?.score ?? 0,
        topCandidates,
      };
    });
  }

  async apply(matches: ApplyMatchDto[], createdBy = 0): Promise<ApplyResult[]> {
    const results: ApplyResult[] = [];

    for (const m of matches) {
      try {
        if (m.action === 'create') {
          if (!m.email) {
            throw new Error('No se puede crear la persona: falta el email en el Excel');
          }
          if (!m.nombreCompleto?.trim()) {
            throw new Error('No se puede crear la persona: falta el nombre en el Excel');
          }
          const { firstName, lastName } = splitFullName(m.nombreCompleto);
          const created = await this.users.create({
            email: m.email,
            firstName,
            lastName,
            roleId: DEFAULT_NEW_USER_ROLE_ID,
            campusId: m.campusId,
            birthDate: m.birthDate,
          } as any, createdBy);
          results.push({ rowKey: m.rowKey, userId: created.id, status: 'success' });
        } else {
          if (!m.userId) throw new Error('Falta userId para actualizar');
          const nameFields: { firstName?: string; lastName?: string } =
            m.nombreCompleto?.trim() ? splitFullName(m.nombreCompleto) : {};

          const currentSnap = await this.fb.db.collection('users').doc(String(m.userId)).get();
          if (!currentSnap.exists) throw new Error(`Usuario ${m.userId} no encontrado`);
          const current = currentSnap.data()!;

          const changed =
            (m.email     !== undefined && m.email     !== current.email) ||
            (m.birthDate !== undefined && m.birthDate !== current.birthDate) ||
            (m.campusId  !== undefined && m.campusId  !== current.campusId) ||
            (nameFields.firstName !== undefined && nameFields.firstName !== current.firstName) ||
            (nameFields.lastName  !== undefined && nameFields.lastName  !== current.lastName);

          if (!changed) {
            results.push({ rowKey: m.rowKey, userId: m.userId, status: 'skipped', message: 'Sin cambios' });
            continue;
          }

          await this.users.update(m.userId, {
            ...nameFields,
            email:     m.email,
            birthDate: m.birthDate,
            campusId:  m.campusId,
          });
          results.push({ rowKey: m.rowKey, userId: m.userId, status: 'success' });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error desconocido';
        this.logger.warn(`No se pudo aplicar rowKey=${m.rowKey} action=${m.action}: ${message}`);
        results.push({ rowKey: m.rowKey, userId: m.userId, status: 'error', message });
      }
    }

    return results;
  }

  private resolveCampus(rawCampus: string | undefined, campuses: any[]): number | null {
    if (!rawCampus) return null;
    const norm = normalizeName(rawCampus.replace(/^campus\s+/i, ''));
    const found = campuses.find((c) => {
      const name   = normalizeName(String(c.name ?? ''));
      const siglas = normalizeName(String(c.siglas ?? ''));
      return name === norm || name.includes(norm) || norm.includes(name) || (siglas && siglas === norm);
    });
    return found ? found.id : null;
  }
}
