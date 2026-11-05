// Hojas del Excel del reporte semanal: mismas tres tablas que el correo.

import type { Celda, FilaSemanal, ReporteSemanal } from '@/hooks/useReporteSemanal';

const ESTADO: Record<string, string> = { sin_reporte: 'S/R', enviado: 'P/R', observado: 'Obs.', programado: 'Prog.' };
type Cell = string | number;

export function parseRecipients(text: string) {
  const items = text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const valid = Array.from(new Set(items.filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))));
  const invalid = items.filter((s) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  return { valid, invalid };
}

/** Lo que hay que completar o revisar antes de enviar (sin filas repetidas por presencial/online). */
export function pendingItems(r: ReporteSemanal) {
  const seen = new Set<string>();
  const items: FilaSemanal[] = [];
  for (const d of r.dias) for (const p of d.paises) for (const f of p.filas) {
    if (f.totales || f.estado === 'programado' || f.estado === 'subido') continue;
    const key = `${f.campusId}|${f.fecha}|${f.hora}|${f.encuentro}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(f);
  }
  const order: Record<string, number> = { sin_reporte: 0, observado: 1, enviado: 2 };
  return items.sort((a, b) => (order[a.estado] ?? 3) - (order[b.estado] ?? 3) || a.fecha.localeCompare(b.fecha) || a.campus.localeCompare(b.campus) || a.hora.localeCompare(b.hora));
}

export function weeklySheets(r: ReporteSemanal): { name: string; rows: Cell[][] }[] {
  const semanal: Cell[][] = [['País', 'Fecha', 'Día', 'Campus', 'Hora', 'Modalidad', 'Tipo Encuentro', 'Total Gral', 'Total Audit.', 'N° P.A.J']];
  for (const d of r.dias) {
    for (const p of d.paises) {
      for (const f of p.filas) {
        const status = f.totales ? null : ESTADO[f.estado] ?? 'S/R';
        semanal.push([f.pais, f.fecha, f.dia, f.campus, f.hora, f.modalidad, f.tipo,
          status ?? f.totales!.totalGral, status ?? (f.totales!.totalAudit ?? 'n/a'), status ?? f.totales!.paj]);
      }
      if (d.paises.length > 1 && p.filas.length > 1) semanal.push(['', '', '', '', '', '', `Total ${p.pais}`, p.subtotal.totalGral, p.subtotal.totalAudit, p.subtotal.paj]);
    }
    semanal.push(['', '', '', '', '', '', `Total ${d.dia} ${d.fecha}`, d.total.totalGral, d.total.totalAudit, d.total.paj]);
  }
  semanal.push(['', '', '', '', '', '', 'TOTAL SEM.', r.totalSemana.totalGral, r.totalSemana.totalAudit, r.totalSemana.paj]);

  const value = (c: Celda, k: 'totalGral' | 'totalAudit' | 'paj'): Cell => (typeof c === 'string' ? c : c[k]);
  const campus: Cell[][] = [['Campus', 'País', 'Día', 'Semana', 'Total gral', 'Total audit.', 'PAJ']];
  for (const c of r.campus) {
    for (const [label, week] of [[`${r.anterior.desde} al ${r.anterior.hasta}`, c.anterior], [`${r.semana.desde} al ${r.semana.hasta}`, c.actual]] as const) {
      for (const dia of c.dias) campus.push([c.campus, c.pais, dia, label, value(week.porDia[dia], 'totalGral'), value(week.porDia[dia], 'totalAudit'), value(week.porDia[dia], 'paj')]);
      campus.push([c.campus, c.pais, 'Totales semanales', label, week.semana.totalGral, week.semana.totalAudit, week.semana.paj]);
    }
    campus.push([c.campus, c.pais, 'Diferencia', '', c.diferencia.totalGral, c.diferencia.totalAudit, c.diferencia.paj]);
  }

  const t = r.comparacion;
  const comparacion: Cell[][] = [
    ['Comparativa semanal', 'Total General', 'Total auditorio', 'P.A.J.'],
    [`${r.anterior.desde} al ${r.anterior.hasta}`, t.anterior.totalGral, t.anterior.totalAudit, t.anterior.paj],
    [`${r.semana.desde} al ${r.semana.hasta}`, t.actual.totalGral, t.actual.totalAudit, t.actual.paj],
    ['Diferencia', t.diferencia.totalGral, t.diferencia.totalAudit, t.diferencia.paj],
  ];
  return [
    { name: 'Reporte semanal', rows: semanal },
    { name: 'Semana anterior vs actual', rows: campus },
    { name: 'Comparación', rows: comparacion },
  ];
}
