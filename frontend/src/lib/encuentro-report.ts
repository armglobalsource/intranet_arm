export const PRAYER_VOLUNTEERS = [
  {key: 'oradores', label: 'Oradores'}, {key: 'servicio', label: 'Servicio'},
  {key: 'tecnica', label: 'Técnica'}, {key: 'worship', label: 'Worship'},
  {key: 'cocina', label: 'Cocina'}, {key: 'rrss', label: 'Redes sociales'},
  {key: 'seguridad', label: 'Seguridad'},
];

export const isPrayerReport = (tipo: string, encuentro: string) => tipo === 'encuentro' && /\boraci[oó]n\b/i.test(encuentro);

export function mergeReportFields(...groups: {key: string; label: string}[][]) {
  return Array.from(new Map(groups.flat().map(c => [c.key, c])).values());
}

export interface ReportDraft {
  tipo: 'encuentro' | 'evento';
  /** Un reporte nuevo exige los datos completos; al editar uno antiguo solo se revisa lo escrito. */
  isNew: boolean;
  fecha: string;
  today: string;
  nowTime: string;
  encuentro: string;
  /** Hora del encuentro cuando sale de los horarios del campus. */
  hora?: string;
  eventoNombre: string;
  eventoHora: string;
  modalidad: string;
  fullReport: boolean;
  prayer: boolean;
  predicador: string;
  aceptoPresencial: string;
  aceptoOnline: string;
  espectadores: string;
  asistencia: Record<string, string>;
  voluntarios: Record<string, string>;
}

const MAX_COUNT = 1_000_000;

function countError(value: string) {
  const v = value.trim();
  if (v === '') return null;
  if (!/^\d+$/.test(v)) return 'Usa solo números enteros';
  return Number(v) > MAX_COUNT ? 'Revisa esta cifra' : null;
}

const total = (r: Record<string, string>) => Object.values(r).reduce((n, v) => n + (Number(v) || 0), 0);
const filled = (r: Record<string, string>) => Object.values(r).some((v) => v.trim() !== '');

/** Errores por campo: `asistencia.kids`, `voluntarios`, `predicador`… Vacío si el reporte se puede guardar. */
export function validateReport(r: ReportDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const online = /online|virtual/i.test(r.modalidad);
  const presencial = r.modalidad !== 'Online';
  if (!r.fecha) errors.fecha = 'Elige la fecha';
  else if (r.fecha > r.today) errors.fecha = 'No puede ser una fecha futura';
  if (r.tipo === 'encuentro') {
    if (!r.encuentro.trim()) errors.encuentro = 'Elige el encuentro';
    else if (r.isNew && r.hora && r.fecha === r.today && r.nowTime < r.hora) {
      errors.encuentro = `Este encuentro parte a las ${r.hora}. Podrás reportarlo cuando termine.`;
    }
  } else {
    if (!r.eventoNombre.trim()) errors.eventoNombre = 'Escribe el nombre del evento';
    if (!r.eventoHora) errors.eventoHora = 'Indica la hora';
  }
  for (const group of ['asistencia', 'voluntarios'] as const) {
    for (const [key, value] of Object.entries(r[group])) {
      const error = countError(value);
      if (error) errors[`${group}.${key}`] = error;
    }
  }
  for (const key of ['aceptoPresencial', 'aceptoOnline', 'espectadores'] as const) {
    const error = countError(r[key]);
    if (error) errors[key] = error;
  }
  if (r.isNew) {
    if (r.tipo === 'encuentro' && !r.prayer && r.fullReport && !r.predicador.trim()) errors.predicador = 'Escribe quién predicó';
    if (presencial && !(r.asistencia.auditorio ?? '').trim()) errors['asistencia.auditorio'] = 'Falta este dato (si no hubo, escribe 0)';
    if (presencial && !filled(r.voluntarios)) errors.voluntarios = 'Ingresa al menos un área (si no hubo, escribe 0)';
    if (online && !r.espectadores.trim()) errors.espectadores = 'Falta este dato (si no hubo, escribe 0)';
  }
  const asistentes = total(r.asistencia);
  if (!errors.aceptoPresencial && asistentes > 0 && Number(r.aceptoPresencial) > asistentes) {
    errors.aceptoPresencial = `No puede ser mayor que los asistentes (${asistentes})`;
  }
  return errors;
}

/**
 * Compara la asistencia con la mediana de ese mismo encuentro: un cero de más
 * o de menos al digitar se nota. Con menos de 3 reportes no hay con qué comparar.
 */
export function atypicalAttendance(asistentes: number, history: number[]): { tipico: number } | null {
  const sample = history.filter((n) => n > 0).sort((a, b) => a - b);
  if (sample.length < 3 || asistentes <= 0) return null;
  const tipico = sample[Math.floor(sample.length / 2)];
  return asistentes > tipico * 2.5 || asistentes < tipico * 0.3 ? { tipico } : null;
}

/** Agrupa los pendientes de un campus por fecha, conservando el orden que entrega la API. */
export function groupByDate<T extends { fecha: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.fecha, [...(groups.get(item.fecha) ?? []), item]);
  return Array.from(groups, ([fecha, list]) => ({ fecha, items: list }));
}
