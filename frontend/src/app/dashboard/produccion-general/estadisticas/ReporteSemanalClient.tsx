'use client';

// Reporte semanal de todos los campus (lo que antes se armaba a mano):
// se elige la semana, se revisa, se descarga y se envía por correo.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Mail, Printer, RefreshCw } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useDestinatariosReporte, useEnviarReporteSemanal, useReporteSemanal } from '@/hooks/useReporteSemanal';
import { parseRecipients, pendingItems, weeklySheets } from '@/lib/weekly-report-export';
import { STATS_ROOT } from '@/lib/statistics-navigation';

const RECIPIENTS_KEY = 'arm-reporte-semanal-destinatarios';
function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function monday(date: string) { return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)); }
function label(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
const fmt = (n: number) => n.toLocaleString('es-CL');
function shortLabel(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); }
const STATE_LABEL: Record<string, string> = { sin_reporte: 'Sin reporte', enviado: 'Por revisar', observado: 'Observado' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

function readRecipients() { try { return localStorage.getItem(RECIPIENTS_KEY) ?? ''; } catch { return ''; } }
function saveRecipients(value: string) { try { localStorage.setItem(RECIPIENTS_KEY, value); } catch { /* sin almacenamiento */ } }

function Kpi({ title, actual, diferencia, enCurso }: { title: string; actual: number; diferencia: number; enCurso: boolean }) {
  // Con la semana en curso la diferencia engaña: se muestra la cifra de la semana anterior como referencia.
  return <div className="weekly-kpi"><span>{title}</span><strong>{fmt(actual)}</strong>
    {enCurso ? <em>Semana anterior: {fmt(actual - diferencia)}</em>
      : <em className={diferencia > 0 ? 'up' : diferencia < 0 ? 'down' : ''}>{diferencia > 0 ? '+' : ''}{fmt(diferencia)} vs semana anterior</em>}</div>;
}

export function ReporteSemanalClient() {
  const { isAdmin, can } = usePermissions();
  const allowed = isAdmin || can('estadisticas:viewAll');
  const params = useSearchParams();
  const thisWeek = monday(today());
  const lastWeek = addDays(thisWeek, -7);
  const initial = params?.get('semana');
  // Abre en la semana en curso: así se ve lo que falta mientras todavía se puede completar.
  const [semana, setSemana] = useState(initial && /^\d{4}-\d{2}-\d{2}$/.test(initial) ? monday(initial) : thisWeek);
  const [porRevisar, setPorRevisar] = useState(false);
  const query = useReporteSemanal(allowed ? semana : '', porRevisar);
  const enviar = useEnviarReporteSemanal();
  const [dialog, setDialog] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [aceptaIncompleto, setAceptaIncompleto] = useState(false);
  // Lista compartida del servidor; si aún no se puede guardar ahí, la de este navegador.
  const guardados = useDestinatariosReporte(allowed);
  useEffect(() => {
    if (!guardados.isFetched) return;
    const server = guardados.data?.destinatarios ?? [];
    setRecipients(server.length ? server.join('\n') : readRecipients());
  }, [guardados.isFetched, guardados.data]);
  const listaCompartida = guardados.data?.disponible === true;

  const weeks: string[] = [];
  for (let w = monday(today()), i = 0; i < 26; w = addDays(w, -7), i++) weeks.push(w);
  const r = query.data;
  const parsed = parseRecipients(recipients);
  const pendientesLista = r ? pendingItems(r) : [];
  const pendientes = pendientesLista.length;

  async function descargar() {
    if (!r) return;
    const XLSX = await import('xlsx');
    const book = XLSX.utils.book_new();
    for (const sheet of weeklySheets(r)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
    XLSX.writeFile(book, `reporte-semanal-${r.semana.desde}.xlsx`);
  }

  async function confirmarEnvio() {
    if (!parsed.valid.length || parsed.invalid.length || (pendientes > 0 && !aceptaIncompleto)) return;
    try {
      const res = await enviar.mutateAsync({ semana, porRevisar, destinatarios: parsed.valid });
      saveRecipients(parsed.valid.join('\n'));
      setDialog(false);
      setNotice({ ok: true, text: `Reporte enviado a ${res.destinatarios} destinatario${res.destinatarios === 1 ? '' : 's'}.` });
    } catch (err) {
      setNotice({ ok: false, text: apiErrorMessage(err, 'No se pudo enviar el reporte.') });
      setDialog(false);
    }
  }

  if (!allowed) {
    return <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      El reporte semanal reúne todos los campus. Para verlo necesitas el permiso «Ver estadísticas de todos los campus».
    </div>;
  }


  return <div className="stats-control weekly-report mx-auto max-w-6xl space-y-4 pb-8">
    <header className="stats-control-header">
      <div><p className="stats-eyebrow">ESTADÍSTICAS</p><h1>Reporte semanal</h1><p>Se arma solo con los reportes de los campus. Revisa los pendientes y la vista previa; al final puedes enviarlo por correo.</p></div>
      <div className="stats-control-actions">
        <Link href={`${STATS_ROOT}/operacion`}>Control de reportes</Link>
      </div>
    </header>

    <section className="stats-control-filters" aria-label="Semana del reporte">
      <label>Semana<select aria-label="Semana" value={semana} onChange={(e) => setSemana(e.target.value)}>
        {weeks.map((w) => <option key={w} value={w}>{label(w)} — {label(addDays(w, 6))}</option>)}
      </select></label>
      <div className="stats-week-actions">
        <button aria-label="Semana anterior" onClick={() => setSemana(addDays(semana, -7))}><ChevronLeft size={18} /></button>
        {semana === thisWeek
          ? <button onClick={() => setSemana(lastWeek)}><CalendarDays size={15} />Ver semana cerrada</button>
          : <button onClick={() => setSemana(thisWeek)}><CalendarDays size={15} />Ir a esta semana</button>}
        <button aria-label="Semana siguiente" disabled={semana >= monday(today())} onClick={() => setSemana(addDays(semana, 7))}><ChevronRight size={18} /></button>
        <button aria-label="Actualizar reporte" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} /></button>
      </div>
      <div className="weekly-toggle-wrap">
        <label className="weekly-toggle"><input type="checkbox" aria-describedby="weekly-toggle-help" checked={porRevisar} onChange={(e) => setPorRevisar(e.target.checked)} />Sumar también los reportes por revisar</label>
        <p id="weekly-toggle-help">Por defecto solo suman los reportes aprobados por el administrador de cada campus. Márcalo para ver un adelanto con los que aún esperan aprobación.</p>
      </div>
    </section>

    {notice && <div role={notice.ok ? 'status' : 'alert'} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</div>}

    {query.isLoading ? <p role="status" className="stats-empty">Armando el reporte de la semana…</p>
      : query.isError || !r ? <div role="alert" className="stats-empty">No pudimos armar el reporte. <button onClick={() => void query.refetch()}>Reintentar</button></div>
      : <>
        <div className="weekly-kpis" aria-label="Totales de la semana">
          <Kpi title="Total General" actual={r.comparacion.actual.totalGral} diferencia={r.comparacion.diferencia.totalGral} enCurso={r.enCurso} />
          <Kpi title="Total auditorio" actual={r.comparacion.actual.totalAudit} diferencia={r.comparacion.diferencia.totalAudit} enCurso={r.enCurso} />
          <Kpi title="P.A.J." actual={r.comparacion.actual.paj} diferencia={r.comparacion.diferencia.paj} enCurso={r.enCurso} />
        </div>
        {r.enCurso && <p className="weekly-status"><strong>Semana en curso.</strong> {r.resumen.programados ? `${r.resumen.programados} encuentro${r.resumen.programados === 1 ? '' : 's'} aún no se realiza${r.resumen.programados === 1 ? '' : 'n'}. ` : ''}Las cifras se actualizan a medida que los campus suben y aprueban sus reportes.</p>}
        <section className="weekly-pending" aria-label="Pendientes antes de enviar">
          <div className="weekly-pending-head">
            <h2>{pendientes ? `Pendientes antes de enviar (${pendientes})` : 'Sin pendientes'}</h2>
            <Link href={`${STATS_ROOT}/operacion`}>Ver en Control de reportes →</Link>
          </div>
          {pendientes ? <ul>{pendientesLista.map((p) => (
            <li key={`${p.campusId}-${p.fecha}-${p.hora}-${p.encuentro}`}>
              <span className={`weekly-chip weekly-chip-${p.estado}`}>{STATE_LABEL[p.estado]}</span>
              <span className="weekly-pending-what"><strong>{p.campus}</strong><span>{shortLabel(p.fecha)}{p.hora ? ` · ${p.hora}` : ''} · {p.evento ? p.tipo : 'Encuentro'}</span></span>
            </li>))}</ul>
            : <p className="weekly-pending-ok">Todos los encuentros que ya ocurrieron tienen su reporte aprobado.</p>}
          {pendientes > 0 && <p className="weekly-pending-note">Mientras estén pendientes, estas filas aparecen marcadas en el reporte y no suman en los totales.</p>}
        </section>
        <div className="weekly-actions">
          <button type="button" onClick={() => void descargar()}><Download size={16} aria-hidden="true" />Descargar Excel</button>
          <button type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Imprimir o guardar PDF</button>
        </div>
        <section aria-label="Vista previa del reporte" className="weekly-preview">
          <p className="weekly-preview-label">Vista previa del correo{pendientes || r.enCurso ? ' · el correo incluye además el aviso de pendientes' : ''}</p>
          <div className="weekly-print" dangerouslySetInnerHTML={{ __html: r.html }} />
        </section>
        <section className="weekly-send" aria-label="Enviar el reporte">
          <div>
            <h2>¿Revisaste el reporte?</h2>
            <p>{pendientes ? `Quedan ${pendientes} pendiente${pendientes === 1 ? '' : 's'}: puedes esperar a que se completen o enviarlo indicando que está incompleto.` : 'Todo lo que ya ocurrió tiene su reporte aprobado.'}</p>
          </div>
          <button type="button" className="weekly-send-button" onClick={() => { setNotice(null); setAceptaIncompleto(false); setDialog(true); }}><Mail size={16} aria-hidden="true" />Enviar por correo</button>
        </section>
      </>}

    {dialog && r && <div className="stats-dialog-backdrop" onKeyDown={(e) => { if (e.key === 'Escape') setDialog(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="weekly-send-title" className="stats-dialog">
        <h2 id="weekly-send-title" className="text-lg font-bold text-slate-900">Enviar el reporte por correo</h2>
        <p className="mt-1 text-sm text-slate-600">Semana {label(r.semana.desde)} al {label(r.semana.hasta)} · {porRevisar ? 'incluye reportes por revisar' : 'solo reportes aprobados'}.</p>
        {r.enCurso && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">La semana aún no termina: el reporte puede cambiar.</p>}
        {pendientes > 0 && <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={aceptaIncompleto} onChange={(e) => setAceptaIncompleto(e.target.checked)} />
          <span>Entiendo que el reporte está incompleto: hay {pendientes} pendiente{pendientes === 1 ? '' : 's'} que no suma{pendientes === 1 ? '' : 'n'}. El correo lo indicará.</span>
        </label>}
        <label className="mt-4 grid gap-1.5 text-xs font-semibold text-slate-600">Destinatarios (uno por línea o separados por coma)
          <textarea autoFocus rows={5} value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="nombre@armglobal.org"
            aria-invalid={parsed.invalid.length > 0} aria-describedby="weekly-recipients-help"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
        </label>
        <p id="weekly-recipients-help" className={`mt-1 text-xs ${parsed.invalid.length ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
          {parsed.invalid.length ? `Revisa: ${parsed.invalid.slice(0, 3).join(', ')}` : `${parsed.valid.length} destinatario${parsed.valid.length === 1 ? '' : 's'}. ${listaCompartida ? 'La lista queda guardada para el próximo envío, desde cualquier equipo.' : 'La lista queda guardada en este navegador para el próximo envío.'}`}
        </p>
        <div className="mt-5 grid gap-2">
          <button type="button" disabled={!parsed.valid.length || parsed.invalid.length > 0 || (pendientes > 0 && !aceptaIncompleto) || enviar.isPending} onClick={() => void confirmarEnvio()}
            className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{enviar.isPending ? 'Enviando…' : pendientes ? 'Enviar reporte incompleto' : 'Enviar reporte'}</button>
          <button type="button" onClick={() => setDialog(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Cancelar</button>
        </div>
      </div>
    </div>}
  </div>;
}

