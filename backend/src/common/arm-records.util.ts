// Helpers compartidos por los módulos de dominio ARM (encuentros, siembra,
// kiloamor, anuncios): mapeo de id, suma de conteos y filtro por período.
// Evita duplicar esta lógica en cada servicio.

export type Periodo =
  | 'semana' | 'mes' | 'mes_ant' | 'trim' | 'anio' | 'anio_ant' | 'todo';

/**
 * El helper genérico de FirebaseService pone el id del doc bajo la clave
 * `fichaId`. Para los módulos ARM lo renombramos a `id`.
 */
export function mapId<T = any>(row: any): T {
  const { fichaId, ...rest } = row;
  return { id: fichaId, ...rest } as T;
}

/** Suma los valores numéricos de un objeto de conteos (ignora no-números). */
export function sumCounts(obj?: Record<string, any>): number {
  if (!obj) return 0;
  return Object.values(obj).reduce<number>(
    (acc, v) => acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
    0,
  );
}

/** ¿La fecha (string) cae dentro del período pedido? Filtrado en memoria. */
export function inPeriodo(fecha: string | undefined, periodo: Periodo = 'todo'): boolean {
  if (periodo === 'todo') return true;
  if (!fecha) return false;
  const f = new Date(fecha);
  if (isNaN(f.getTime())) return false;
  const now = new Date();
  const ny = now.getFullYear();
  const nm = now.getMonth();
  switch (periodo) {
    case 'mes':      return f.getFullYear() === ny && f.getMonth() === nm;
    case 'mes_ant': {
      const d = new Date(ny, nm - 1, 1);
      return f.getFullYear() === d.getFullYear() && f.getMonth() === d.getMonth();
    }
    case 'trim':     return f.getFullYear() === ny && f.getMonth() >= nm - 2;
    case 'anio':     return f.getFullYear() === ny;
    case 'anio_ant': return f.getFullYear() === ny - 1;
    case 'semana': {
      const day = (now.getDay() + 6) % 7; // lunes = 0
      const start = new Date(ny, nm, now.getDate() - day);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return f >= start && f < end;
    }
    default: return true;
  }
}

/** ¿La fecha cae en el año (y mes opcional, 1-12) pedido? Filtrado en memoria, mismo estilo que inPeriodo. */
export function inMonth(fecha: string | undefined, year: number, month?: number): boolean {
  if (!fecha) return false;
  const f = new Date(fecha);
  if (isNaN(f.getTime())) return false;
  if (f.getFullYear() !== year) return false;
  if (month !== undefined && f.getMonth() + 1 !== month) return false;
  return true;
}
