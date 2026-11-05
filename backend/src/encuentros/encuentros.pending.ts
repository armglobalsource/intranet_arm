// Encuentros que debieron ocurrir según los horarios de cada campus y que
// todavía no tienen registro. Para cada campus y día, primero se emparejan los
// registros cuya hora coincide con un horario («Encuentro Domingo 09:00 hrs»);
// los que sobran se emparejan con el horario más cercano (un campus puede
// tener el jueves a las 19:30 y reportarlo como «Jueves 20:00 hrs»). Los
// horarios que quedan sin registro son los pendientes.
// También se señalan registros con fecha dudosa: el nombre dice un día de la
// semana distinto al de su fecha (típico error de digitación).
//
// Cada campus se revisa desde el día siguiente a su último reporte, para que
// aparezca todo lo que falta subir, y además los últimos días, para encontrar
// huecos anteriores a ese reporte.

import { sameEncuentroLabel } from './encuentros.scope';

export const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Horas después del inicio en que un encuentro ya debería poder reportarse. */
const READY_AFTER_HOURS = 2;
/** Días hacia atrás que siempre se revisan, para encontrar huecos antes del último reporte. */
export const HOLE_DAYS = 14;
/** Tope hacia atrás cuando un campus lleva mucho tiempo sin reportar. */
export const MAX_BACK_DAYS = 120;

export interface PendingCampus {
  id: number;
  name: string;
  isActive?: boolean;
  schedules?: { dia: string; hora: string; fichaType?: string }[];
}
export interface PendingRecord { id?: string; campusId?: unknown; campus?: string; fecha?: string; fechaPrecision?: string; encuentro?: string; tipo?: string }
export interface PendingEncuentro { campusId: number; campus: string; fecha: string; hora: string; encuentro: string }
export interface CampusProgress { campusId: number; campus: string; ultimoReporte: string | null; pendientes: number }
export interface DoubtfulRecord { id?: string; campusId: number; campus: string; fecha: string; encuentro: string; diaFecha: string; diaNombre: string }

export function hhmm(hora: string): string | null {
  const m = /(\d{1,2})[:.](\d{2})/.exec(hora ?? '');
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}
const minutes = (h: string | null) => (h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function encuentroName(dia: string, hora: string, fichaType?: string) {
  return fichaType === 'oracion' ? `Encuentro Oración ${dia} ${hora} hrs` : `Encuentro ${dia} ${hora} hrs`;
}

function addDays(fecha: string, days: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const weekdayOf = (fecha: string) => DAYS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];

/** Día de la semana escrito en el nombre del encuentro, si hay uno. */
function weekdayInName(name: string): string | null {
  const text = plain(name);
  return DAYS.find((d) => new RegExp(`\\b${plain(d)}\\b`).test(text)) ?? null;
}

/**
 * @param now fecha y hora actuales en Chile ('AAAA-MM-DD' y 'HH:MM'): los
 *   horarios de los campus se escriben en hora local de cada campus, y la
 *   referencia práctica de la operación es la hora de Chile.
 */
export function pendingEncuentros(
  campuses: PendingCampus[], records: PendingRecord[], from: string, to: string,
  now: { date: string; time: string },
): PendingEncuentro[] {
  const byDay = new Map<string, (string | null)[]>();
  for (const r of records) {
    if (r.tipo === 'evento' || r.fechaPrecision === 'mes') continue;
    const key = `${String(r.campusId)}|${String(r.fecha ?? '').slice(0, 10)}`;
    byDay.set(key, [...(byDay.get(key) ?? []), hhmm(r.encuentro ?? '')]);
  }
  const pending: PendingEncuentro[] = [];
  for (let fecha = from; fecha <= to && fecha <= now.date; fecha = addDays(fecha, 1)) {
    const dia = weekdayOf(fecha);
    for (const c of campuses) {
      if (c.isActive === false) continue;
      const schedules = (c.schedules ?? [])
        .map((s) => ({ ...s, hora: hhmm(s.hora) }))
        .filter((s): s is { dia: string; hora: string; fichaType?: string } => s.dia === dia && !!s.hora);
      if (!schedules.length) continue;
      const left = [...schedules];
      // Un duplicado de las 09:00 nunca cubre el encuentro de las 11:00.
      const reports = [...new Set(byDay.get(`${c.id}|${fecha}`) ?? [])];
      // 1) misma hora
      for (let i = reports.length - 1; i >= 0; i--) {
        const j = left.findIndex((s) => s.hora === reports[i]);
        if (j >= 0) { left.splice(j, 1); reports.splice(i, 1); }
      }
      // 2) Solo tolerar un desfase pequeño y sin ambigüedad (19:30 / 20:00).
      while (reports.length && left.length) {
        let best = { i: 0, j: 0, d: Infinity };
        reports.forEach((h, i) => left.forEach((s, j) => {
          const d = h ? Math.abs(minutes(h)! - minutes(s.hora)!) : 24 * 60;
          if (d < best.d) best = { i, j, d };
        }));
        if (best.d > 30) break;
        const candidates = left.filter(s => reports[best.i] && Math.abs(minutes(reports[best.i])! - minutes(s.hora)!) <= 30);
        if (candidates.length !== 1) { reports.splice(best.i, 1); continue; }
        reports.splice(best.i, 1); left.splice(best.j, 1);
      }
      for (const s of left) {
        const startsAt = Date.parse(`${fecha}T${s.hora}:00Z`);
        const nowAt = Date.parse(`${now.date}T${now.time}:00Z`);
        if (startsAt + READY_AFTER_HOURS * 60 * 60 * 1000 > nowAt) continue;
        pending.push({ campusId: c.id, campus: c.name, fecha, hora: s.hora, encuentro: encuentroName(dia, s.hora, s.fichaType) });
      }
    }
  }
  return pending.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.campus.localeCompare(b.campus) || a.hora.localeCompare(b.hora));
}

/** Desde qué día hay que revisar un campus: lo que venga antes, su último reporte o los últimos días. */
function reviewFrom(lastReport: string | undefined, today: string, holeDays: number) {
  const recent = addDays(today, -(holeDays - 1));
  const afterLast = lastReport ? addDays(lastReport, 1) : recent;
  const floor = addDays(today, -(MAX_BACK_DAYS - 1));
  const from = afterLast < recent ? afterLast : recent;
  return from < floor ? floor : from;
}

/** Primer día que hay que leer de la base para revisar todos los campus. */
export function earliestReviewDate(campuses: PendingCampus[], lastReports: Map<string, string>, today: string, holeDays = HOLE_DAYS) {
  return campuses.reduce((min, c) => {
    const from = reviewFrom(lastReports.get(String(c.id)), today, holeDays);
    return from < min ? from : min;
  }, reviewFrom(undefined, today, holeDays));
}

/**
 * Pendientes de cada campus desde su último reporte, en orden: campus, fecha y
 * hora. Va del más antiguo al más nuevo para continuar desde donde quedó.
 */
export function pendingFromLastReport(
  campuses: PendingCampus[], records: PendingRecord[], lastReports: Map<string, string>,
  now: { date: string; time: string }, holeDays = HOLE_DAYS,
) {
  const pendientes: PendingEncuentro[] = [];
  const progreso: CampusProgress[] = [];
  const ordered = [...campuses].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  for (const c of ordered) {
    if (c.isActive === false || !c.schedules?.length) continue;
    const ultimoReporte = lastReports.get(String(c.id)) ?? null;
    const own = records.filter((r) => String(r.campusId) === String(c.id));
    const items = pendingEncuentros([c], own, reviewFrom(ultimoReporte ?? undefined, now.date, holeDays), now.date, now)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
    pendientes.push(...items);
    progreso.push({ campusId: c.id, campus: c.name, ultimoReporte, pendientes: items.length });
  }
  return { pendientes, progreso };
}

/**
 * El reporte que ya existe para ese encuentro, si lo hay. Coincide por nombre
 * y, para los encuentros de los horarios del campus, también si ese horario ya
 * quedó cubierto por un reporte escrito con otra hora («Jueves 20:00 hrs» para
 * un horario de las 19:30), igual que al calcular los pendientes.
 */
export function existingReport(
  campus: PendingCampus, records: PendingRecord[], fecha: string, encuentro: string, tipo: 'encuentro' | 'evento' = 'encuentro',
): PendingRecord | null {
  const sameDay = records.filter((r) => r.fechaPrecision !== 'mes' && String(r.fecha ?? '').slice(0, 10) === fecha && (r.tipo === 'evento') === (tipo === 'evento'));
  const byName = sameDay.find((r) => sameEncuentroLabel(r.encuentro, encuentro));
  if (byName || tipo === 'evento') return byName ?? null;
  const dia = weekdayOf(fecha), hora = hhmm(encuentro);
  const slot = (campus.schedules ?? []).find((s) => s.dia === dia && hhmm(s.hora) === hora
    && sameEncuentroLabel(encuentroName(dia, hora ?? '', s.fichaType), encuentro));
  if (!slot || !sameDay.length) return null;
  const open = pendingEncuentros([{ ...campus, isActive: true }], sameDay, fecha, fecha, { date: addDays(fecha, 1), time: '00:00' });
  if (open.some((p) => p.hora === hora)) return null;
  const distance = (r: PendingRecord) => Math.abs((minutes(hhmm(r.encuentro ?? '')) ?? 0) - minutes(hora)!);
  return [...sameDay].sort((a, b) => distance(a) - distance(b))[0];
}

/** Registros cuyo nombre dice un día de la semana distinto al de su fecha. */
export function doubtfulDates(records: PendingRecord[], campuses: PendingCampus[]): DoubtfulRecord[] {
  const names = new Map(campuses.map((c) => [String(c.id), c.name]));
  return records
    .filter((r) => r.tipo !== 'evento' && r.fechaPrecision !== 'mes' && r.fecha)
    .map((r) => {
      const fecha = String(r.fecha).slice(0, 10);
      return { r, fecha, diaFecha: weekdayOf(fecha), diaNombre: weekdayInName(r.encuentro ?? '') };
    })
    .filter((x) => x.diaNombre && x.diaNombre !== x.diaFecha)
    .map(({ r, fecha, diaFecha, diaNombre }) => ({
      id: r.id, campusId: Number(r.campusId), campus: r.campus ?? names.get(String(r.campusId)) ?? '', fecha,
      encuentro: r.encuentro ?? '', diaFecha, diaNombre: diaNombre!,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Fecha y hora actuales en Chile. */
export function nowInSantiago(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
