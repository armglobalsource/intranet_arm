// HTML del reporte semanal: el mismo documento se muestra en la intranet y se
// envía por correo. Solo tablas con estilos en línea, para que se vea igual en
// Gmail, Outlook y el teléfono.

import type { Cell, CampusComparison, Totals, WeeklyReport, WeeklyRow } from './weekly-report';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/** 2706 → 2.706; -26 → -26 */
export const fmt = (n: number) => `${n < 0 ? '-' : ''}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const day = (fecha: string) => `${fecha.slice(8, 10)} ${MONTHS[Number(fecha.slice(5, 7)) - 1]}`;
const shortDay = (fecha: string) => `${fecha.slice(8, 10)} ${SHORT[Number(fecha.slice(5, 7)) - 1]}`;
export const weekLabel = (r: { desde: string; hasta: string }) => `${Number(r.desde.slice(8, 10))} ${SHORT[Number(r.desde.slice(5, 7)) - 1]} al ${shortDay(r.hasta)}`;

const C = { ink: '#172532', muted: '#5c6b79', line: '#c9d1d9', head: '#d9dee3', dark: '#3f4a54', soft: '#f4f6f8', warn: '#93370d', warnBg: '#fef6e7', red: '#b42318' };
const td = (extra = '') => `style="border:1px solid ${C.line};padding:4px 8px;font-size:13px;color:${C.ink};${extra}"`;
const th = (extra = '') => `style="border:1px solid ${C.line};padding:5px 8px;font-size:13px;font-weight:700;background:${C.head};color:${C.ink};${extra}"`;
const dark = (extra = '') => `style="border:1px solid ${C.dark};padding:5px 8px;font-size:13px;font-weight:700;background:${C.dark};color:#fff;${extra}"`;
const table = (inner: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 18px;font-family:Arial,Helvetica,sans-serif">${inner}</table>`;

const ESTADO: Record<string, string> = { sin_reporte: 'S/R', enviado: 'P/R', observado: 'Obs.' };

function rowCells(r: WeeklyRow) {
  const center = 'text-align:center;';
  const online = r.modalidad === 'On Line' ? `background:${C.head};font-weight:700;` : '';
  const status = r.totales ? null : ESTADO[r.estado] ?? 'S/R';
  const numCell = (v: number | null | undefined) => `<td ${td(`${center}${status ? `color:${C.warn};background:${C.warnBg};` : ''}`)}>${status ?? (v == null ? 'n/a' : fmt(v))}</td>`;
  return `<td ${td(center)}>${esc(r.hora || '—')}</td><td ${td(center + online)}>${r.modalidad}</td><td ${td(center)}>${esc(r.tipo)}</td>`
    + numCell(r.totales?.totalGral) + numCell(r.totales ? r.totales.totalAudit : 0) + numCell(r.totales?.paj);
}

function totalsRow(label: string, t: Totals, span: number, strong = true) {
  const style = strong ? dark : th;
  return `<tr><td colspan="${span}" style="border:0"></td><td ${style('text-align:right')}>${esc(label)}</td><td ${style('text-align:center')}>${fmt(t.totalGral)}</td><td ${style('text-align:center')}>${fmt(t.totalAudit)}</td><td ${style('text-align:center')}>${fmt(t.paj)}</td></tr>`;
}

function weeklyTable(report: WeeklyReport) {
  const head = `<tr>${['País', 'Fecha', 'Día', 'Campus', 'Hora', 'Modalidad', 'Tipo Encuentro', 'Total Gral', 'Total Audit.', 'N° P.A.J'].map((h) => `<th ${th('text-align:center')}>${h}</th>`).join('')}</tr>`;
  const blocks = report.dias.map((b) => {
    const body = b.paises.map((p) => {
      const lines = p.filas.map((r, i) => {
        const first = i === 0;
        const campusFirst = i === 0 || p.filas[i - 1].campus !== r.campus;
        const campusSpan = p.filas.filter((x) => x.campus === r.campus).length;
        return `<tr>${first ? `<td rowspan="${p.filas.length}" ${td('text-align:center;font-weight:700')}>${esc(p.pais)}</td><td rowspan="${p.filas.length}" ${td('text-align:center')}>${day(b.fecha)}</td><td rowspan="${p.filas.length}" ${td('text-align:center')}>${b.dia}</td>` : ''}`
          + `${campusFirst ? `<td rowspan="${campusSpan}" ${td('text-align:center')}>${esc(r.campus)}</td>` : ''}${rowCells(r)}</tr>`;
      }).join('');
      const subtotal = b.paises.length > 1 && p.filas.length > 1 ? totalsRow(`Total ${p.pais}:`, p.subtotal, 6, false) : '';
      return lines + subtotal;
    }).join('');
    return table(head + body + totalsRow('Total', b.total, 6));
  }).join('');
  return blocks + table(`<tr><td style="border:0;width:60%"></td><td style="padding:6px 10px;background:#000;color:#fff;font-weight:700;font-size:15px">TOTAL SEM.</td><td style="padding:6px 10px;background:#000;color:#fff;font-weight:700;font-size:15px;text-align:center">${fmt(report.totalSemana.totalGral)}</td><td style="padding:6px 10px;background:#000;color:#fff;font-weight:700;font-size:15px;text-align:center">${fmt(report.totalSemana.totalAudit)}</td><td style="padding:6px 10px;background:#000;color:#fff;font-weight:700;font-size:15px;text-align:center">${fmt(report.totalSemana.paj)}</td></tr>`);
}

function cellValues(c: Cell): [string, string, string] {
  return typeof c === 'string' ? [c, c, c] : [fmt(c.totalGral), fmt(c.totalAudit), fmt(c.paj)];
}

function campusCard(c: CampusComparison, report: WeeklyReport) {
  const groups = [...c.dias, 'Totales Semanales'];
  const head1 = `<tr><td style="border:0"></td><th colspan="${groups.length * 3}" ${dark('text-align:center;font-size:14px')}>Campus ${esc(c.campus)}</th></tr>`;
  const head2 = `<tr><td style="border:0"></td>${groups.map((g) => `<th colspan="3" ${th('text-align:center')}>${esc(g)}</th>`).join('')}</tr>`;
  const head3 = `<tr><td style="border:0"></td>${groups.map(() => ['Total gral', 'Total audit.', 'PAJ'].map((h) => `<th ${th('text-align:center;font-weight:400;background:#fff')}>${h}</th>`).join('')).join('')}</tr>`;
  const line = (label: string, week: CampusComparison['actual'], color = C.ink) =>
    `<tr><td ${td('white-space:nowrap;font-size:12px')}>${label}</td>${c.dias.map((d) => cellValues(week.porDia[d]).map((v) => `<td ${td(`text-align:center;color:${color}`)}>${v}</td>`).join('')).join('')}`
    + cellValues(week.semana).map((v) => `<td ${td(`text-align:center;color:${color}`)}>${v}</td>`).join('') + '</tr>';
  const diffCells = c.dias.map((d) => {
    const a = c.actual.porDia[d], b = c.anterior.porDia[d];
    if (typeof a === 'string' || typeof b === 'string') return [0, 1, 2].map(() => `<td ${td('text-align:center;font-weight:700')}>${typeof a === 'string' && a === 'n/a' && b === 'n/a' ? 'n/a' : '—'}</td>`).join('');
    return [a.totalGral - b.totalGral, a.totalAudit - b.totalAudit, a.paj - b.paj].map((v) => `<td ${td('text-align:center;font-weight:700')}>${fmt(v)}</td>`).join('');
  }).join('') + [c.diferencia.totalGral, c.diferencia.totalAudit, c.diferencia.paj].map((v) => `<td ${td('text-align:center;font-weight:700')}>${fmt(v)}</td>`).join('');
  const note = c.eventos.length ? `<tr><td colspan="${groups.length * 3 + 1}" style="padding:4px 0 0;font-size:12px;color:${C.red}">Los datos de ${esc(c.eventos.join(', '))} se sumaron en los Totales semanales del Campus ${esc(c.campus)}.</td></tr>` : '';
  return table(head1 + head2 + head3 + line(`Sem. ${weekLabel(report.anterior)}`, c.anterior) + line(`Sem. ${weekLabel(report.semana)}`, c.actual)
    + `<tr><td ${td('font-weight:700')}>Diferencia</td>${diffCells}</tr>` + note);
}

export function renderWeeklyReportHtml(report: WeeklyReport, opts: { appUrl?: string } = {}) {
  const r = report.resumen;
  const avisos = [
    r.sinReporte ? `${r.sinReporte} encuentro${r.sinReporte === 1 ? '' : 's'} sin reporte (S/R)` : '',
    r.porRevisar ? `${r.porRevisar} reporte${r.porRevisar === 1 ? '' : 's'} por revisar (P/R), aún no aprobado${r.porRevisar === 1 ? '' : 's'} por el administrador de campus` : '',
    r.observados ? `${r.observados} reporte${r.observados === 1 ? '' : 's'} devuelto${r.observados === 1 ? '' : 's'} con observación (Obs.)` : '',
  ].filter(Boolean);
  const aviso = avisos.length
    ? `<div style="margin:0 0 18px;padding:10px 14px;border:1px solid #f6d48b;border-radius:10px;background:${C.warnBg};color:${C.warn};font-size:13px;line-height:1.5"><strong>Datos incompletos:</strong> ${avisos.map(esc).join(' · ')}. Estas filas no suman en los totales.</div>`
    : '';
  const cmp = report.comparacion;
  const comparacion = table(`<tr>${['Comparativa Semanal', 'Total General', 'Total auditorio', 'P.A.J.'].map((h) => `<th ${th('text-align:center')}>${h}</th>`).join('')}</tr>`
    + `<tr><td ${td()}>Sem. ${weekLabel(report.anterior)}</td><td ${td('text-align:center')}>${fmt(cmp.anterior.totalGral)}</td><td ${td('text-align:center')}>${fmt(cmp.anterior.totalAudit)}</td><td ${td('text-align:center')}>${fmt(cmp.anterior.paj)}</td></tr>`
    + `<tr><td ${td()}>Sem. ${weekLabel(report.semana)}</td><td ${td('text-align:center')}>${fmt(cmp.actual.totalGral)}</td><td ${td('text-align:center')}>${fmt(cmp.actual.totalAudit)}</td><td ${td('text-align:center')}>${fmt(cmp.actual.paj)}</td></tr>`
    + `<tr><td ${dark()}>Diferencia</td><td ${dark('text-align:center')}>${fmt(cmp.diferencia.totalGral)}</td><td ${dark('text-align:center')}>${fmt(cmp.diferencia.totalAudit)}</td><td ${dark('text-align:center')}>${fmt(cmp.diferencia.paj)}</td></tr>`);
  const legend = table(['n/a|No aplica', 'S/R|Sin reporte', 'P/R|Por revisar', 'Obs.|Devuelto con observación']
    .map((x) => x.split('|')).map(([k, v]) => `<tr><td ${td('width:60px')}>${k}</td><td ${td()}>${v}</td></tr>`).join(''));
  const h2 = (text: string) => `<h2 style="margin:26px 0 10px;font-size:17px;text-align:center;color:${C.ink};border-bottom:1px solid ${C.ink};padding-bottom:4px">${text}</h2>`;
  const link = opts.appUrl ? `<p style="font-size:12px;color:${C.muted}">Ver en Ecosistema ARM: <a href="${esc(opts.appUrl)}" style="color:#173e32">${esc(opts.appUrl)}</a></p>` : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${C.ink};max-width:960px;margin:0 auto">`
    + `<p style="margin:0;font-size:12px;letter-spacing:2px;color:${C.muted}">ESTADÍSTICAS ARM GLOBAL</p>`
    + `<h1 style="margin:4px 0 4px;font-size:22px">Reporte semanal · Sem. ${weekLabel(report.semana)}</h1>`
    + `<p style="margin:0 0 16px;font-size:13px;color:${C.muted}">${report.incluyePorRevisar ? 'Incluye reportes aprobados y por revisar.' : 'Incluye solo reportes aprobados por el administrador de cada campus.'} Total Gral = asistentes + voluntarios (online: espectadores).</p>`
    + aviso
    + h2('REPORTE SEMANAL') + (report.dias.length ? weeklyTable(report) : `<p style="font-size:13px;color:${C.muted}">No hay encuentros registrados en esta semana.</p>`)
    + legend
    + h2('RESUMEN SEMANA ANTERIOR VS LA ACTUAL') + report.campus.map((c) => campusCard(c, report)).join('')
    + h2('Comparación semanal de todos los campus') + comparacion
    + link + '</div>';
}

/** Versión de texto plano para clientes de correo sin HTML. */
export function renderWeeklyReportText(report: WeeklyReport) {
  const t = report.comparacion;
  return [
    `Reporte semanal ARM · Sem. ${weekLabel(report.semana)}`,
    '',
    `Total General: ${fmt(t.actual.totalGral)} (semana anterior ${fmt(t.anterior.totalGral)}, diferencia ${fmt(t.diferencia.totalGral)})`,
    `Total auditorio: ${fmt(t.actual.totalAudit)} (anterior ${fmt(t.anterior.totalAudit)}, diferencia ${fmt(t.diferencia.totalAudit)})`,
    `P.A.J.: ${fmt(t.actual.paj)} (anterior ${fmt(t.anterior.paj)}, diferencia ${fmt(t.diferencia.paj)})`,
    '',
    ...report.campus.map((c) => `${c.campus}: ${fmt(c.actual.semana.totalGral)} total · ${fmt(c.actual.semana.totalAudit)} auditorio · ${fmt(c.actual.semana.paj)} PAJ`),
    '',
    'Abre el correo en un cliente con HTML para ver las tablas completas.',
  ].join('\n');
}
