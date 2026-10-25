// Encuentros que debieron ocurrir según los horarios de cada campus y que
// todavía no tienen registro. Para cada campus y día, primero se emparejan los
// registros cuya hora coincide con un horario («Encuentro Domingo 09:00 hrs»);
// los que sobran se emparejan con el horario más cercano (un campus puede
// tener el jueves a las 19:30 y reportarlo como «Jueves 20:00 hrs»). Los
// horarios que quedan sin registro son los pendientes.
// También se señalan registros con fecha dudosa: el nombre dice un día de la
// semana distinto al de su fecha (típico error de digitación).

export const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Horas después del inicio en que un encuentro ya debería poder reportarse. */
const READY_AFTER_HOURS = 2;

export interface PendingCampus {
  id: number;
  name: string;
  isActive?: boolean;
  schedules?: { dia: string; hora: string; fichaType?: string }[];
}
export interface PendingRecord { id?: string; campusId?: unknown; campus?: string; fecha?: string; encuentro?: string; tipo?: string }
export interface PendingEncuentro { campusId: number; campus: string; fecha: string; hora: string; encuentro: string }
export interface DoubtfulRecord { id?: string; campusId: number; campus: string; fecha: string; encuentro: string; diaFecha: string; diaNombre: string }

export function hhmm(hora: string): string | null {
  const m = /(\d{1,2})[:.](\d{2})/.exec(hora ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
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
    if (r.tipo === 'evento') continue;
    const key = `${String(r.campusId)}|${String(r.fecha ?? '').slice(0, 10)}`;
    byDay.set(key, [...(byDay.get(key) ?? []), hhmm(r.encuentro ?? '')]);
  }
  const nowMinutes = minutes(now.time)!;
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
      const reports = [...(byDay.get(`${c.id}|${fecha}`) ?? [])];
      // 1) misma hora
      for (let i = reports.length - 1; i >= 0; i--) {
        const j = left.findIndex((s) => s.hora === reports[i]);
        if (j >= 0) { left.splice(j, 1); reports.splice(i, 1); }
      }
      // 2) el resto, con el horario más cercano
      while (reports.length && left.length) {
        let best = { i: 0, j: 0, d: Infinity };
        reports.forEach((h, i) => left.forEach((s, j) => {
          const d = h ? Math.abs(minutes(h)! - minutes(s.hora)!) : 24 * 60;
          if (d < best.d) best = { i, j, d };
        }));
        reports.splice(best.i, 1); left.splice(best.j, 1);
      }
      for (const s of left) {
        if (fecha === now.date && minutes(s.hora)! + READY_AFTER_HOURS * 60 > nowMinutes) continue;
        pending.push({ campusId: c.id, campus: c.name, fecha, hora: s.hora, encuentro: encuentroName(dia, s.hora, s.fichaType) });
      }
    }
  }
  return pending.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.campus.localeCompare(b.campus) || a.hora.localeCompare(b.hora));
}

/** Registros cuyo nombre dice un día de la semana distinto al de su fecha. */
export function doubtfulDates(records: PendingRecord[], campuses: PendingCampus[]): DoubtfulRecord[] {
  const names = new Map(campuses.map((c) => [String(c.id), c.name]));
  return records
    .filter((r) => r.tipo !== 'evento' && r.fecha)
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
