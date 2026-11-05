// Reporte semanal que antes se armaba a mano y se enviaba por correo:
// 1) los encuentros de la semana por día, país, campus y hora;
// 2) cada campus contra la semana anterior;
// 3) la comparación de todos los campus.
// Total Gral = asistentes + voluntarios (online: espectadores) · Total Audit. = Auditorio ·
// P.A.J. = personas que aceptaron a Jesús. Los encuentros de oración no forman parte del reporte.

import { sumCounts } from '../common/arm-records.util';
import { estadoDe, type EstadoReporte } from '../encuentros/encuentros.review';
import { DAYS, hhmm, pendingEncuentros } from '../encuentros/encuentros.pending';
import { countryName } from './statistics-range';

export interface WeeklyCampus { id: number; name: string; country?: string | null; isActive?: boolean; schedules?: { dia: string; hora: string; fichaType?: string }[] }
export interface Totals { totalGral: number; totalAudit: number; paj: number }
export type RowEstado = EstadoReporte | 'sin_reporte';
export interface WeeklyRow {
  campusId: number; campus: string; pais: string; fecha: string; dia: string; hora: string;
  modalidad: 'Presencial' | 'On Line'; tipo: string; evento: boolean;
  estado: RowEstado;
  /** null: el reporte aún no cuenta (sin reporte, por revisar u observado). */
  totales: { totalGral: number; totalAudit: number | null; paj: number } | null;
}
export interface DayBlock { fecha: string; dia: string; paises: { pais: string; filas: WeeklyRow[]; subtotal: Totals }[]; total: Totals }
/** n/a: el campus no tiene encuentro ese día · S/R: sin reporte · P/R: por revisar · Obs.: devuelto con observación. */
export type Cell = Totals | 'n/a' | 'S/R' | 'P/R' | 'Obs.';
export interface CampusComparison {
  campusId: number; campus: string; pais: string; dias: string[];
  anterior: { porDia: Record<string, Cell>; semana: Totals };
  actual: { porDia: Record<string, Cell>; semana: Totals };
  diferencia: Totals;
  /** Eventos (p. ej. JVNS X TEENS) sumados en los totales semanales. */
  eventos: string[];
}
export interface WeeklyReport {
  semana: { desde: string; hasta: string };
  anterior: { desde: string; hasta: string };
  incluyePorRevisar: boolean;
  dias: DayBlock[];
  totalSemana: Totals;
  campus: CampusComparison[];
  comparacion: { anterior: Totals; actual: Totals; diferencia: Totals };
  resumen: { incluidos: number; sinReporte: number; porRevisar: number; observados: number };
}

const zero = (): Totals => ({ totalGral: 0, totalAudit: 0, paj: 0 });
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const plain = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isPrayer = (r: any) => r.tipo !== 'evento' && /oracion/.test(plain(r.encuentro));
const isOnline = (modalidad: unknown) => /online|virtual/.test(plain(modalidad));
const hasPresencial = (modalidad: unknown) => plain(modalidad).replace(/\s/g, '') !== 'online';

export function addDays(fecha: string, days: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function mondayOf(fecha: string) {
  return addDays(fecha, -((new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7));
}
const weekdayOf = (fecha: string) => DAYS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
/** Lunes primero y domingo al final, como en el reporte manual. */
const dayOrder = (dia: string) => (DAYS.indexOf(dia) + 6) % 7;

function add(target: Totals, t: { totalGral: number; totalAudit: number | null; paj: number }) {
  target.totalGral += t.totalGral;
  target.totalAudit += t.totalAudit ?? 0;
  target.paj += t.paj;
}
const diff = (a: Totals, b: Totals): Totals => ({ totalGral: a.totalGral - b.totalGral, totalAudit: a.totalAudit - b.totalAudit, paj: a.paj - b.paj });

function campusResolver(campuses: WeeklyCampus[]) {
  const byId = new Map(campuses.map((c) => [Number(c.id), c]));
  const byName = new Map<string, WeeklyCampus[]>();
  for (const c of campuses) byName.set(plain(c.name).trim(), [...(byName.get(plain(c.name).trim()) ?? []), c]);
  return (r: any): WeeklyCampus | undefined => {
    if (r.campusId != null && r.campusId !== '') return byId.get(Number(r.campusId));
    const matches = byName.get(plain(r.campus).trim()) ?? [];
    return matches.length === 1 ? matches[0] : undefined;
  };
}

const regularSchedules = (c: WeeklyCampus) => (c.schedules ?? []).filter((s) => s.fichaType !== 'oracion' && !!hhmm(s.hora));

/** Filas del reporte de una semana: cada reporte (presencial y online por separado) y los encuentros sin reporte. */
export function weeklyRows(
  records: any[], campuses: WeeklyCampus[], desde: string, hasta: string,
  opts: { incluirPorRevisar: boolean; now: { date: string; time: string } },
): WeeklyRow[] {
  const resolve = campusResolver(campuses);
  const rows: WeeklyRow[] = [];
  const inWeek = records.filter((r) => {
    const fecha = String(r.fecha ?? '').slice(0, 10);
    return r.fechaPrecision !== 'mes' && fecha >= desde && fecha <= hasta && !isPrayer(r);
  });
  for (const r of inWeek) {
    const campus = resolve(r);
    if (!campus) continue;
    const fecha = String(r.fecha).slice(0, 10);
    const estado = estadoDe(r);
    const cuenta = estado === 'subido' || (estado === 'enviado' && opts.incluirPorRevisar);
    const evento = r.tipo === 'evento';
    const nombreEvento = String(r.eventoNombre || r.encuentro || 'Evento').replace(/\s*\d{1,2}:\d{2}\s*hrs?\.?$/i, '').trim();
    const hora = hhmm(r.encuentro ?? '') ?? hhmm(r.eventoHorario ?? '') ?? hhmm(r.eventoNombre ?? '') ?? '';
    const base = { campusId: Number(campus.id), campus: campus.name, pais: countryName(campus.country), fecha, dia: weekdayOf(fecha), hora, evento, estado };
    if (hasPresencial(r.modalidad)) {
      const asistentes = typeof r.totalAsistencia === 'number' ? r.totalAsistencia : sumCounts(r.asistencia);
      const voluntarios = typeof r.totalVoluntarios === 'number' ? r.totalVoluntarios : sumCounts(r.voluntarios);
      rows.push({ ...base, modalidad: 'Presencial', tipo: evento ? nombreEvento : 'Encuentro',
        totales: cuenta ? { totalGral: asistentes + voluntarios, totalAudit: num(r.asistencia?.auditorio), paj: num(r.presencial?.acepto) } : null });
    }
    if (isOnline(r.modalidad)) {
      rows.push({ ...base, modalidad: 'On Line', tipo: evento ? nombreEvento : 'Enc. Global',
        totales: cuenta ? { totalGral: num(r.online?.espectadores), totalAudit: null, paj: num(r.online?.acepto) } : null });
    }
  }
  // Encuentros de la agenda del campus que no tienen ningún reporte (en cualquier estado).
  const agenda = campuses.map((c) => ({ ...c, schedules: regularSchedules(c) }));
  for (const p of pendingEncuentros(agenda as any, inWeek as any, desde, hasta, opts.now)) {
    const campus = campuses.find((c) => Number(c.id) === p.campusId)!;
    rows.push({ campusId: p.campusId, campus: p.campus, pais: countryName(campus.country), fecha: p.fecha, dia: weekdayOf(p.fecha), hora: p.hora,
      modalidad: 'Presencial', tipo: 'Encuentro', evento: false, estado: 'sin_reporte', totales: null });
  }
  return rows;
}

const countryRank = (pais: string) => (pais === 'Chile' ? '0' : `1${pais}`);
const rowOrder = (a: WeeklyRow, b: WeeklyRow) =>
  countryRank(a.pais).localeCompare(countryRank(b.pais)) || a.campus.localeCompare(b.campus, 'es')
  || (a.hora || '99').localeCompare(b.hora || '99') || Number(a.evento) - Number(b.evento) || Number(a.modalidad === 'On Line') - Number(b.modalidad === 'On Line');

function dayBlocks(rows: WeeklyRow[]): DayBlock[] {
  const fechas = [...new Set(rows.map((r) => r.fecha))].sort();
  return fechas.map((fecha) => {
    const filas = rows.filter((r) => r.fecha === fecha).sort(rowOrder);
    const paises = [...new Set(filas.map((r) => r.pais))].map((pais) => {
      const dePais = filas.filter((r) => r.pais === pais);
      const subtotal = zero();
      dePais.forEach((r) => r.totales && add(subtotal, r.totales));
      return { pais, filas: dePais, subtotal };
    });
    const total = zero();
    filas.forEach((r) => r.totales && add(total, r.totales));
    return { fecha, dia: weekdayOf(fecha), paises, total };
  });
}

function campusWeek(rows: WeeklyRow[], campus: WeeklyCampus, dias: string[]) {
  const mine = rows.filter((r) => r.campusId === Number(campus.id));
  const semana = zero();
  mine.forEach((r) => r.totales && add(semana, r.totales));
  const scheduled = new Set(regularSchedules(campus).map((s) => s.dia));
  const porDia: Record<string, Cell> = {};
  for (const dia of dias) {
    const delDia = mine.filter((r) => r.dia === dia && !r.evento);
    if (!delDia.length) { porDia[dia] = scheduled.has(dia) ? 'S/R' : 'n/a'; continue; }
    const t = zero();
    delDia.forEach((r) => r.totales && add(t, r.totales));
    porDia[dia] = delDia.some((r) => r.totales) ? t
      : delDia.some((r) => r.estado === 'enviado') ? 'P/R' : delDia.some((r) => r.estado === 'observado') ? 'Obs.' : 'S/R';
  }
  return { porDia, semana };
}

export function buildWeeklyReport(
  records: any[], campuses: WeeklyCampus[], semana: string,
  opts: { incluirPorRevisar: boolean; now: { date: string; time: string } },
): WeeklyReport {
  const desde = mondayOf(semana), hasta = addDays(desde, 6);
  const prevDesde = addDays(desde, -7), prevHasta = addDays(desde, -1);
  const actuales = weeklyRows(records, campuses, desde, hasta, opts);
  const anteriores = weeklyRows(records, campuses, prevDesde, prevHasta, opts);

  const totalOf = (rows: WeeklyRow[]) => { const t = zero(); rows.forEach((r) => r.totales && add(t, r.totales)); return t; };
  const actual = totalOf(actuales), anterior = totalOf(anteriores);

  const visibles = campuses.filter((c) => c.isActive !== false || [...actuales, ...anteriores].some((r) => r.campusId === Number(c.id)));
  const comparacion: CampusComparison[] = visibles
    .filter((c) => regularSchedules(c).length || [...actuales, ...anteriores].some((r) => r.campusId === Number(c.id)))
    .map((c) => {
      const rows = [...actuales, ...anteriores].filter((r) => r.campusId === Number(c.id));
      const dias = [...new Set([...regularSchedules(c).map((s) => s.dia), ...rows.filter((r) => !r.evento).map((r) => r.dia)])]
        .sort((a, b) => dayOrder(a) - dayOrder(b));
      const act = campusWeek(actuales, c, dias), ant = campusWeek(anteriores, c, dias);
      const eventos = [...new Set(actuales.filter((r) => r.campusId === Number(c.id) && r.evento && r.totales).map((r) => r.tipo))];
      return { campusId: Number(c.id), campus: c.name, pais: countryName(c.country), dias, anterior: ant, actual: act, diferencia: diff(act.semana, ant.semana), eventos };
    })
    .sort((a, b) => countryRank(a.pais).localeCompare(countryRank(b.pais)) || a.campus.localeCompare(b.campus, 'es'));

  const count = (estado: RowEstado) => new Set(actuales.filter((r) => r.estado === estado).map((r) => `${r.campusId}|${r.fecha}|${r.hora}|${r.tipo}`)).size;
  return {
    semana: { desde, hasta },
    anterior: { desde: prevDesde, hasta: prevHasta },
    incluyePorRevisar: opts.incluirPorRevisar,
    dias: dayBlocks(actuales),
    totalSemana: actual,
    campus: comparacion,
    comparacion: { anterior, actual, diferencia: diff(actual, anterior) },
    resumen: {
      incluidos: new Set(actuales.filter((r) => r.totales).map((r) => `${r.campusId}|${r.fecha}|${r.hora}|${r.tipo}`)).size,
      sinReporte: count('sin_reporte'),
      porRevisar: opts.incluirPorRevisar ? 0 : count('enviado'),
      observados: count('observado'),
    },
  };
}
