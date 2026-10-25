// Cada campus registra y ve sus propios encuentros. Ven y registran todos los
// campus el administrador total y quien tiene «Ver estadísticas de todos los campus».

import { ForbiddenException } from '@nestjs/common';
import { hasPermission } from '../common/permissions';

export interface RecordUser { sub: number | string; email: string; campusId?: number | string | null; permissions?: string[] }

export function allCampus(user: RecordUser): boolean {
  const perms = user.permissions ?? [];
  return perms.includes('*') || hasPermission(perms, 'estadisticas:viewAll');
}

export function assertRecordCampus(record: { campusId?: unknown }, user: RecordUser) {
  if (allCampus(user)) return;
  if (user.campusId == null || String(record.campusId) !== String(user.campusId)) {
    throw new ForbiddenException('Solo puedes ver y editar los registros de tu campus');
  }
}

/** Nombre de encuentro comparable: sin tildes, espacios repetidos ni mayúsculas. */
export function sameEncuentroLabel(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(a) !== '' && norm(a) === norm(b);
}
