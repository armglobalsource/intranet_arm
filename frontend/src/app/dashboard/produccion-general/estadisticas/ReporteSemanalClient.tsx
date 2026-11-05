'use client';

// Reporte semanal de todos los campus (lo que antes se armaba a mano):
// se elige la semana, se revisa, se descarga y se envía por correo.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Mail, Printer, RefreshCw } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useEnviarReporteSemanal, useReporteSemanal } from '@/hooks/useReporteSemanal';
import { parseRecipients, weeklySheets } from '@/lib/weekly-report-export';
import { STATS_ROOT } from '@/lib/statistics-navigation';

const RECIPIENTS_KEY = 'arm-reporte-semanal-destinatarios';
function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function monday(date: string) { return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)); }
function label(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
const fmt = (n: number) => n.toLocaleString('es-CL');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

function readRecipients() { try { return localStorage.getItem(RECIPIENTS_KEY) ?? ''; } catch { return ''; } }
function saveRecipients(value: string) { try { localStorage.setItem(RECIPIENTS_KEY, value); } catch { /* sin almacenamiento */ } }

function Kpi({ title, actual, diferencia }: { title: string; actual: number; diferencia: number }) {
  return <div className="weekly-kpi"><span>{title}</span><strong>{fmt(actual)}</strong>
    <em className={diferencia > 0 ? 'up' : diferencia < 0 ? 'down' : ''}>{diferencia > 0 ? '+' : ''}{fmt(diferencia)} vs semana anterior</em></div>;
}

export function ReporteSemanalClient() {
  const { isAdmin, can } = usePermissions();
  const allowed = isAdmin || can('estadisticas:viewAll');
  const params = useSearchParams();
  const lastWeek = addDays(monday(today()), -7);
  const initial = params?.get('semana');
  const [semana, setSemana] = useState(initial && /^\d{4}-\d{2}-\d{2}$/.test(initial) ? monday(initial) : lastWeek);
  const [porRevisar, setPorRevisar] = useState(false);
  const query = useReporteSemanal(allowed ? semana : '', porRevisar);
  const enviar = useEnviarReporteSemanal();
  const [dialog, setDialog] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setRecipients(readRecipients()); }, []);

  const weeks: string[] = [];
  for (let w = monday(today()), i = 0; i < 26; w = addDays(w, -7), i++) weeks.push(w);
  const r = query.data;
  const parsed = parseRecipients(recipients);

  async function descargar() {
    if (!r) return;
    const XLSX = await import('xlsx');
    const book = XLSX.utils.book_new();
    for (const sheet of weeklySheets(r)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
    XLSX.writeFile(book, `reporte-semanal-${r.semana.desde}.xlsx`);
  }

  async function confirmarEnvio() {
    if (!parsed.valid.length || parsed.invalid.length) return;
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

  const pendientes = r ? r.resumen.sinReporte + r.resumen.porRevisar + r.resumen.observados : 0;

  return <div className="stats-control weekly-report mx-auto max-w-6xl space-y-4 pb-8">
    <header className="stats-control-header">
      <div><p className="stats-eyebrow">ESTADÍSTICAS</p><h1>Reporte semanal</h1><p>Las tres tablas del informe de la semana, listas para descargar o enviar por correo.</p></div>
      <div className="stats-control-actions">
        <Link href={`${STATS_ROOT}/operacion`}>Control de reportes</Link>
        <button type="button" className="stats-primary" disabled={!r} onClick={() => { setNotice(null); setDialog(true); }}><Mail size={16} aria-hidden="true" />Enviar por correo</button>
      </div>
    </header>

    <section className="stats-control-filters" aria-label="Semana del reporte">
      <label>Semana<select aria-label="Semana" value={semana} onChange={(e) => setSemana(e.target.value)}>
        {weeks.map((w) => <option key={w} value={w}>{label(w)} — {label(addDays(w, 6))}</option>)}
      </select></label>
      <div className="stats-week-actions">
        <button aria-label="Semana anterior" onClick={() => setSemana(addDays(semana, -7))}><ChevronLeft size={18} /></button>
        <button onClick={() => setSemana(lastWeek)}><CalendarDays size={15} />Última semana cerrada</button>
        <button aria-label="Semana siguiente" disabled={semana >= monday(today())} onClick={() => setSemana(addDays(semana, 7))}><ChevronRight size={18} /></button>
        <button aria-label="Actualizar reporte" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} /></button>
      </div>
      <label className="weekly-toggle"><input type="checkbox" checked={porRevisar} onChange={(e) => setPorRevisar(e.target.checked)} />Incluir reportes por revisar</label>
    </section>

    {notice && <div role={notice.ok ? 'status' : 'alert'} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</div>}

    {query.isLoading ? <p role="status" className="stats-empty">Armando el reporte de la semana…</p>
      : query.isError || !r ? <div role="alert" className="stats-empty">No pudimos armar el reporte. <button onClick={() => void query.refetch()}>Reintentar</button></div>
      : <>
        <div className="weekly-kpis" aria-label="Totales de la semana">
          <Kpi title="Total General" actual={r.comparacion.actual.totalGral} diferencia={r.comparacion.diferencia.totalGral} />
          <Kpi title="Total auditorio" actual={r.comparacion.actual.totalAudit} diferencia={r.comparacion.diferencia.totalAudit} />
          <Kpi title="P.A.J." actual={r.comparacion.actual.paj} diferencia={r.comparacion.diferencia.paj} />
        </div>
        {pendientes > 0 && <aside className="stats-control-warning">
          <strong>Hay datos incompletos en esta semana.</strong>
          <p>{[r.resumen.sinReporte && `${r.resumen.sinReporte} sin reporte`, r.resumen.porRevisar && `${r.resumen.porRevisar} por revisar`, r.resumen.observados && `${r.resumen.observados} observados`].filter(Boolean).join(' · ')}. Esas filas aparecen marcadas y no suman. <Link className="underline" href={`${STATS_ROOT}/operacion`}>Ver en Control de reportes</Link></p>
        </aside>}
        <div className="weekly-actions">
          <button type="button" onClick={() => void descargar()}><Download size={16} aria-hidden="true" />Descargar Excel</button>
          <button type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Imprimir o guardar PDF</button>
        </div>
        <section aria-label="Vista previa del reporte" className="weekly-preview">
          <div className="weekly-print" dangerouslySetInnerHTML={{ __html: r.html }} />
        </section>
      </>}

    {dialog && r && <div className="stats-dialog-backdrop" onKeyDown={(e) => { if (e.key === 'Escape') setDialog(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="weekly-send-title" className="stats-dialog">
        <h2 id="weekly-send-title" className="text-lg font-bold text-slate-900">Enviar el reporte por correo</h2>
        <p className="mt-1 text-sm text-slate-600">Semana {label(r.semana.desde)} al {label(r.semana.hasta)} · {porRevisar ? 'incluye reportes por revisar' : 'solo reportes aprobados'}.</p>
        {pendientes > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Faltan datos: {pendientes} fila{pendientes === 1 ? '' : 's'} no suma{pendientes === 1 ? '' : 'n'}. El correo lo indicará.</p>}
        <label className="mt-4 grid gap-1.5 text-xs font-semibold text-slate-600">Destinatarios (uno por línea o separados por coma)
          <textarea autoFocus rows={5} value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="nombre@armglobal.org"
            aria-invalid={parsed.invalid.length > 0} aria-describedby="weekly-recipients-help"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
        </label>
        <p id="weekly-recipients-help" className={`mt-1 text-xs ${parsed.invalid.length ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
          {parsed.invalid.length ? `Revisa: ${parsed.invalid.slice(0, 3).join(', ')}` : `${parsed.valid.length} destinatario${parsed.valid.length === 1 ? '' : 's'}. La lista queda guardada en este navegador para el próximo envío.`}
        </p>
        <div className="mt-5 grid gap-2">
          <button type="button" disabled={!parsed.valid.length || parsed.invalid.length > 0 || enviar.isPending} onClick={() => void confirmarEnvio()}
            className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{enviar.isPending ? 'Enviando…' : 'Enviar reporte'}</button>
          <button type="button" onClick={() => setDialog(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Cancelar</button>
        </div>
      </div>
    </div>}
  </div>;
}

