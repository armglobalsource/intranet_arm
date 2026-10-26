// Revisión de reportes: los líderes de voluntarios envían el reporte de cada
// encuentro y el administrador del campus lo revisa y lo marca como subido, o
// lo devuelve con un comentario («observado») para que lo corrijan.
// Solo los reportes subidos cuentan en Estadísticas. Los importados desde
// Asana (id «asana:…») ya estaban «Registrado» allá y cuentan como subidos.

import { hasPermission } from '../common/permissions';
import type { RecordUser } from './encuentros.scope';

export type EstadoReporte = 'enviado' | 'observado' | 'subido';

export function estadoDe(record: { id?: string; fichaId?: string; estado?: string }): EstadoReporte {
  // Una observación explícita prevalece también sobre una importación histórica.
  if (record.estado === 'observado') return 'observado';
  if (!record.estado || record.estado === 'validado') return 'subido';
  // El almacén entrega el id como fichaId; la API, ya mapeado como id.
  if (String(record.id ?? record.fichaId ?? '').startsWith('asana:')) return 'subido';
  return record.estado === 'subido' ? 'subido' : 'enviado';
}

export const isUploaded = (record: { id?: string; fichaId?: string; estado?: string }) => estadoDe(record) === 'subido';

/** Revisa quien tiene «Revisar y subir reportes» en su campus o figura entre los administradores del campus. */
export function canReview(user: RecordUser, campus: { id: number | string; adminIds?: unknown }): boolean {
  const perms = user.permissions ?? [];
  if (perms.includes('*')) return true;
  const admins = Array.isArray(campus.adminIds) ? campus.adminIds.map(String) : [];
  if (admins.includes(String(user.sub))) return true;
  return hasPermission(perms, 'encuentros:review') && user.campusId != null && String(user.campusId) === String(campus.id);
}

const sameCampus = (user: RecordUser, record: { campusId?: unknown }) =>
  (user.permissions ?? []).includes('*') || (user.campusId != null && String(user.campusId) === String(record.campusId));
const isAuthor = (user: RecordUser, record: { registradoPor?: { uid?: unknown } }) =>
  record.registradoPor?.uid != null && String(record.registradoPor.uid) === String(user.sub);

/**
 * Puede editar: el revisor siempre; mientras no esté subido, quien tiene
 * «Editar encuentros» en el campus o quien lo registró (para corregir lo observado).
 */
export function canEditReport(user: RecordUser, record: any, reviewer: boolean): string | null {
  if (reviewer) return null;
  if (estadoDe(record) === 'subido') return 'Este reporte ya fue subido; solo el administrador del campus puede modificarlo';
  if ((hasPermission(user.permissions ?? [], 'encuentros:edit') && sameCampus(user, record)) || isAuthor(user, record)) return null;
  return 'No puedes editar este reporte';
}

export function canDeleteReport(user: RecordUser, record: any, reviewer: boolean): string | null {
  if (reviewer) return null;
  if (estadoDe(record) === 'subido') return 'Este reporte ya fue subido; solo el administrador del campus puede eliminarlo';
  if (hasPermission(user.permissions ?? [], 'encuentros:delete') && sameCampus(user, record)) return null;
  return 'No puedes eliminar este reporte';
}
