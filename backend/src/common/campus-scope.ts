import { CampusService } from '../campus/campus.service';

/**
 * Campus (por nombre) cuyos registros puede listar el usuario.
 * - Admin: el campus pedido, o `undefined` (todos).
 * - Resto: siempre su propio campus, ignorando lo que pida el cliente.
 * - Sin campus asignado: `null` (no ve nada).
 */
export async function resolveCampusScope(
  user: any,
  requested: string | undefined,
  campusService: CampusService,
): Promise<string | undefined | null> {
  if ((user.permissions ?? []).includes('*')) return requested || undefined;
  if (!user.campusId) return null;
  const campus = await campusService.findOne(Number(user.campusId));
  return campus.name;
}

export function applyLimit<T>(rows: T[], limitText?: string): T[] {
  const limit = Number(limitText);
  return limit > 0 ? rows.slice(0, limit) : rows;
}
