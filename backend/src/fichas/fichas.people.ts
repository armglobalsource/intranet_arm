import { BadRequestException } from '@nestjs/common';
import type { SqlConnection } from '../common/database/identity-sql';

export const ASSIGNMENT_MODES = ['people', 'pending', 'fixed', 'sequence', 'not_applicable', 'team'] as const;
export interface RowAssignment {
  mode: typeof ASSIGNMENT_MODES[number];
  people: { userId: number; name: string }[];
  note: string;
}
const LABELS = { people: '', pending: 'Por confirmar', fixed: 'Fija', sequence: 'Secuencia', not_applicable: 'No aplica', team: 'Equipo' };
export function assignmentText(a: RowAssignment): string {
  return [a.mode === 'people' ? a.people.map(p => p.name).join(' / ') : LABELS[a.mode], a.note].filter(Boolean).join(' · ');
}

/** Names are snapshots from the directory, never trusted client input. No name matching. */
export async function normalizeRowAssignments(rows: any[], oldRows: any[], encounterIds: string[], section: string, campusId: string, global: boolean, db: SqlConnection) {
  const keys = new Set(['shared', ...encounterIds]);
  const ids = new Set<number>();
  for (const row of rows) {
    if (row.assignments == null) continue;
    if (typeof row.assignments !== 'object' || Array.isArray(row.assignments)) throw new BadRequestException('Asignaciones inválidas');
    for (const [key, raw] of Object.entries<any>(row.assignments)) {
      if (!keys.has(key) || (row.shared ? key !== 'shared' : key === 'shared')) throw new BadRequestException('El encuentro de la asignación no es válido');
      if (!raw || !ASSIGNMENT_MODES.includes(raw.mode) || !Array.isArray(raw.people) || raw.people.length > 10 || typeof raw.note !== 'string' || raw.note.length > 500) throw new BadRequestException('Asignación inválida: máximo 10 personas y 500 caracteres de nota');
      if (raw.mode !== 'people' && raw.people.length) throw new BadRequestException('Un recurso o estado no puede tener usuarios asignados');
      const unique = new Set<number>();
      for (const p of raw.people) {
        if (!p || !Number.isSafeInteger(p.userId) || p.userId < 1 || unique.has(p.userId)) throw new BadRequestException('Usuario de asignación inválido o duplicado');
        unique.add(p.userId); ids.add(p.userId);
      }
      if (ids.size > 500) throw new BadRequestException('Demasiados usuarios en una sección');
    }
  }
  const users = ids.size ? (await db.query(`SELECT id, btrim(concat_ws(' ',"firstName","lastName")) AS name, status,"campusId" FROM arm_app.users WHERE id=ANY($1::bigint[])`, [[...ids]])).rows : [];
  const byId = new Map(users.map((u:any) => [Number(u.id), u]));
  for (const row of rows) {
    if (!row.assignments) continue;
    const old = oldRows.find(r => r.id === row.id);
    const next: Record<string, RowAssignment> = {};
    for (const [key, a] of Object.entries<any>(row.assignments)) {
      next[key] = { mode: a.mode, note: a.note.trim(), people: a.people.map((p:any) => {
        // Existing snapshots survive rename/deactivation and explicit copying between encounters.
        const saved = Object.values<any>(old?.assignments ?? {}).flatMap(v => v.people ?? []).find(v => v.userId === p.userId);
        if (saved) return { userId: saved.userId, name: saved.name };
        const user: any = byId.get(p.userId);
        if (!user || user.status !== 'active' || (!global && user.campusId != null && String(user.campusId) !== String(campusId))) throw new BadRequestException('Selecciona un usuario activo disponible en el directorio de esta ficha');
        return { userId: Number(user.id), name: user.name || `Usuario #${user.id}` };
      }) };
      const text = assignmentText(next[key]);
      if (section === 'horarios' || row.type === 'song') {
        let value: any;
        try { value = JSON.parse(row.values[key] || '{}'); } catch { throw new BadRequestException('El momento o la canción necesita formato estructurado para asignar usuarios'); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Valor estructurado inválido');
        row.values[key] = JSON.stringify({ ...value, [section === 'horarios' ? 'responsable' : 'cantante']: text });
      } else row.values[key] = text;
    }
    row.assignments = next;
  }
}
