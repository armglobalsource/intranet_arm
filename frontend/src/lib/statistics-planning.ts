import { statsPreset } from './statistics';

const DAY = 86400000;
const date = (key: string) => Date.parse(`${key}T12:00:00Z`);
const key = (value: number) => new Date(value).toISOString().slice(0, 10);
export function planningRange(now = new Date()) {
  const lastWeek = statsPreset('week', now);
  return { from: key(date(lastWeek.from) - 49 * DAY), to: lastWeek.to };
}
export interface PlanningRecord {
  campusId: number;
  fecha: string;
  fechaPrecision?: 'dia' | 'mes';
  tipo: 'encuentro' | 'evento';
  asistencia: number;
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Missing weeks stay missing: they are never converted into zero attendance. */
export function campusProjection(records: PlanningRecord[], campusId: number, range: { from: string; to: string }) {
  const weeks = Array.from({ length: 8 }, (_, i) => ({ from: key(date(range.from) + i * 7 * DAY), reports: 0, attendance: 0 }));
  const eligible = records.filter(r => r.campusId === campusId && r.tipo === 'encuentro' && r.fechaPrecision !== 'mes'
    && r.fecha >= range.from && r.fecha <= range.to && Number.isFinite(r.asistencia) && r.asistencia >= 0);
  for (const r of eligible) {
    const index = Math.floor((date(r.fecha) - date(range.from)) / (7 * DAY));
    if (weeks[index]) { weeks[index].reports++; weeks[index].attendance += r.asistencia; }
  }
  const observed = weeks.filter(w => w.reports > 0);
  let reason: string | null = null;
  if (observed.length < 6) reason = 'Se necesitan reportes en al menos 6 de las últimas 8 semanas.';
  else if (!weeks[6].reports || !weeks[7].reports) reason = 'Faltan reportes en una de las últimas dos semanas cerradas.';
  else if (!observed.some(w => w.attendance > 0)) reason = 'No hay asistencia presencial positiva para estimar.';
  const weeklyBase = reason ? null : median(observed.map(w => w.attendance));
  return {
    weeks, observedWeeks: observed.length, reports: eligible.length, reason, weeklyBase,
    baseline: weeklyBase === null ? null : Math.round(weeklyBase * 4),
    averagePerMeeting: eligible.length ? Math.round(eligible.reduce((n, r) => n + r.asistencia, 0) / eligible.length) : null,
  };
}
