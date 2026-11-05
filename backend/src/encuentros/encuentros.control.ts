import { doubtfulDates, pendingEncuentros, type PendingCampus, type PendingRecord } from './encuentros.pending';
import { estadoDe } from './encuentros.review';

export function weekStart(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

/** El corte importado permanece fijo al registrar semanas posteriores: no desaparecen huecos. */
export function controlStart(campusId: number, anchors: Map<string, string>, fallback: string) {
  return weekStart(anchors.get(String(campusId)) ?? fallback);
}

export function weeklyControl(
  campuses: (PendingCampus & { country?: string | null })[],
  records: (PendingRecord & { estado?: string })[], anchors: Map<string, string>, fallback: string,
  now: { date: string; time: string },
) {
  const active = campuses.filter(c => c.isActive !== false);
  const progreso = active.map(c => {
    const virtual = c.name.trim().toLowerCase() === 'virtual';
    const configurable = !virtual && !!c.schedules?.length;
    const desde = configurable ? controlStart(c.id, anchors, fallback) : weekStart(fallback);
    const own = records.filter(r => String(r.campusId) === String(c.id) && r.fechaPrecision !== 'mes'
      && String(r.fecha).slice(0, 10) >= desde && String(r.fecha).slice(0, 10) <= now.date);
    const pendientes = configurable ? pendingEncuentros([c], own, desde, now.date, now) : [];
    const ultimoReporte = own.filter(r => r.tipo !== 'evento').map(r => String(r.fecha).slice(0, 10)).sort().slice(-1)[0] ?? anchors.get(String(c.id)) ?? null;
    return { campusId: c.id, campus: c.name, pais: c.country ?? 'Global', desde, ultimoReporte,
      corteHistorico: anchors.get(String(c.id)) ?? null,
      seguimiento: virtual ? 'virtual' as const : configurable ? 'horarios' as const : 'sin_horarios' as const,
      pendientes: pendientes.length, items: pendientes,
      reportes: own.map(r => ({ id: r.id, campusId: c.id, campus: c.name, fecha: String(r.fecha).slice(0, 10),
        encuentro: r.encuentro ?? '', estado: estadoDe(r), tipo: r.tipo ?? 'encuentro' })),
    };
  }).sort((a,b) => a.campus.localeCompare(b.campus, 'es'));
  return {
    pendientes: progreso.flatMap(c => c.items).sort((a,b) => a.fecha.localeCompare(b.fecha) || a.campus.localeCompare(b.campus) || a.hora.localeCompare(b.hora)),
    progreso: progreso.map(({items: _items, reportes: _reports, ...c}) => c),
    reportes: progreso.flatMap(c => c.reportes),
    revisar: doubtfulDates(records.filter(r => active.some(c => String(c.id) === String(r.campusId)) && String(r.fecha).slice(0,10) >= controlStart(Number(r.campusId), anchors, fallback)), active),
    meta: { hasta: now.date, hora: now.time, zona: 'America/Santiago', desde: progreso.reduce((min,c) => c.desde < min ? c.desde : min, now.date) },
  };
}
