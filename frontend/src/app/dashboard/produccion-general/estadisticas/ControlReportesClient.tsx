'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Plus, ClipboardList } from 'lucide-react';
import { usePendientesReporte } from '@/hooks/useRegistrosEncuentros';
import { STATS_ROOT } from '@/lib/statistics-navigation';

function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
function monday(date: string) { return addDays(date,-(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7); }
function dateLabel(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}); }
const labels = { faltante: 'Faltantes', enviado: 'Por revisar', observado: 'Observados', subido: 'Aprobados' };
type Status = keyof typeof labels;

export function ControlReportesClient() {
  const query = usePendientesReporte();
  const [campus, setCampus] = useState('');
  const [week, setWeek] = useState('');
  const [status, setStatus] = useState<Status | 'todos'>('faltante');
  const [limit, setLimit] = useState(24);
  const data = query.data;
  const today = data?.meta?.hasta ?? new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
  const progress = data?.progreso ?? [];
  const selected = progress.filter(c => !campus || String(c.campusId) === campus);
  const permitted = new Set(selected.map(c => c.campusId));
  const range = (date: string) => !week || date >= week && date <= addDays(week,6);
  const rows = [
    ...(data?.pendientes ?? []).map(p => ({...p, id: '', estado: 'faltante' as const, puedeEditar: false})),
    ...(data?.reportes ?? []).map(r => ({...r, hora: ''})),
  ].filter(r => permitted.has(r.campusId) && range(r.fecha))
    .sort((a,b) => a.fecha.localeCompare(b.fecha) || a.campus.localeCompare(b.campus) || a.encuentro.localeCompare(b.encuentro));
  const counts = Object.fromEntries(Object.keys(labels).map(s => [s, rows.filter(r => r.estado === s).length])) as Record<Status,number>;
  const filtered = rows.filter(r => status === 'todos' || r.estado === status);
  const weeks: string[] = [];
  for(let day = monday(today), floor = monday(data?.meta?.desde ?? today); day >= floor; day = addDays(day,-7)) weeks.push(day);
  const needSetup = selected.filter(c => c.seguimiento === 'sin_horarios');
  const virtual = selected.some(c => c.seguimiento === 'virtual');
  const doubtful = (data?.revisar ?? []).filter(r => permitted.has(r.campusId) && range(r.fecha));
  function selectWeek(value: string) { setWeek(value); setLimit(24); }
  const canRegister = selected.some(c => c.puedeRegistrar);

  return <div className="stats-control mx-auto max-w-6xl space-y-4 pb-8">
    <header className="stats-control-header">
      <div><p className="stats-eyebrow">ESTADÍSTICAS</p><h1>Control de reportes</h1><p>Lo que falta, lo que requiere revisión y lo que ya está aprobado.</p></div>
      <div className="stats-control-actions">
        <Link href={STATS_ROOT}>Ver indicadores</Link>
        {canRegister && <Link className="stats-primary" href={`${STATS_ROOT}/registrar`}><Plus size={16} aria-hidden="true"/>Nuevo reporte</Link>}
      </div>
    </header>
    <section className="stats-control-filters" aria-label="Filtros del control">
      <label>Campus<select aria-label="Campus" value={campus} onChange={e => {setCampus(e.target.value);setLimit(24);}}><option value="">Todos mis campus</option>{progress.map(c => <option key={c.campusId} value={c.campusId}>{c.campus}</option>)}</select></label>
      <label>Semana<select aria-label="Semana" value={week} onChange={e => selectWeek(e.target.value)}><option value="">Todo lo pendiente hasta hoy</option>{weeks.map(w => <option key={w} value={w}>{dateLabel(w)} — {dateLabel(addDays(w,6))}</option>)}</select></label>
      <div className="stats-week-actions">
        <button aria-label="Semana anterior" disabled={(week || monday(today)) <= weeks.at(-1)!} onClick={() => selectWeek(addDays(week || monday(today),-7))}><ChevronLeft size={18}/></button>
        <button onClick={() => selectWeek(monday(today))}><CalendarDays size={15}/>Esta semana</button>
        <button aria-label="Semana siguiente" disabled={!week || week >= monday(today)} onClick={() => selectWeek(addDays(week,7))}><ChevronRight size={18}/></button>
        <button aria-label="Actualizar control" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16}/></button>
      </div>
    </section>
    {query.isLoading ? <p role="status" className="stats-empty">Revisando los reportes de tus campus…</p> : query.isError ? <div role="alert" className="stats-empty">No pudimos consultar el control. <button onClick={() => void query.refetch()}>Reintentar</button></div> : <>
      <div className="stats-control-counts" aria-label="Estados de los reportes">{(Object.keys(labels) as Status[]).map(s => <button key={s} aria-pressed={status === s} onClick={() => {setStatus(s);setLimit(24);}} className={`stats-count stats-count-${s}`}><span>{labels[s]}</span><strong>{counts[s]}</strong></button>)}</div>
      <div className="stats-control-caption"><span>Actualizado al {dateLabel(today)}{data?.meta?.hora ? ` · ${data.meta.hora} (Chile)` : ''}</span><button aria-pressed={status === 'todos'} onClick={() => {setStatus('todos');setLimit(24);}}>Ver todos los estados</button></div>
      {needSetup.length > 0 && <aside className="stats-control-warning"><strong>Falta configurar horarios: {needSetup.map(c => c.campus).join(', ')}.</strong><p>No podemos calcular sus faltantes hasta conocer los días y horas de sus encuentros.</p></aside>}
      {virtual && <p className="stats-control-note">Virtual: la audiencia online se registra en el reporte del campus emisor. No se solicita un segundo reporte por esa misma transmisión.</p>}
      <section className="stats-control-list" aria-label="Detalle de reportes">
        <div className="stats-list-heading"><h2>{status === 'todos' ? 'Todos los reportes' : labels[status]} <span>{filtered.length}</span></h2><p>{week ? `${dateLabel(week)} — ${dateLabel(addDays(week,6))}` : 'Desde el cierre del histórico de cada campus'}</p></div>
        {!filtered.length ? <div className="stats-empty"><ClipboardList size={24} aria-hidden="true"/><strong>No hay {status === 'todos' ? 'reportes' : labels[status].toLowerCase()} en esta selección.</strong><p>{needSetup.length ? 'Revisa los campus sin horarios antes de dar el control por completo.' : 'Puedes cambiar de semana o consultar otro estado.'}</p></div> : <ul>{filtered.slice(0,limit).map((r,i) => {
          const c = progress.find(c => c.campusId === r.campusId);
          const register = r.estado === 'faltante' && c?.puedeRegistrar;
          const review = r.estado === 'enviado' && c?.puedeRevisar;
          const href = review ? `${STATS_ROOT}/revisar` : register ? `${STATS_ROOT}/registrar?campus=${r.campusId}&fecha=${r.fecha}&encuentro=${encodeURIComponent(r.encuentro)}` : `${STATS_ROOT}/registrar?editar=${encodeURIComponent(r.id)}`;
          return <li key={r.id || `${r.campusId}-${r.fecha}-${r.encuentro}-${i}`} className="stats-control-row"><div><span className="stats-row-campus">{r.campus}</span><h3>{r.encuentro}</h3><time dateTime={r.fecha}>{dateLabel(r.fecha)}</time></div><div className="stats-row-action"><span className={`stats-status stats-status-${r.estado}`}>{r.estado === 'faltante' ? 'Faltante' : r.estado === 'subido' ? 'Aprobado' : r.estado === 'observado' ? 'Observado' : 'Por revisar'}</span>{register || r.puedeEditar || review ? <Link href={href}>{review ? 'Revisar' : register ? 'Registrar' : r.estado === 'observado' ? 'Corregir' : 'Abrir'} →</Link> : null}</div></li>;
        })}</ul>}
        {filtered.length > limit && <button className="stats-load-more" onClick={() => setLimit(n => n+24)}>Ver más ({filtered.length-limit} restantes)</button>}
      </section>
      {doubtful.length > 0 && <details className="stats-control-warning"><summary>Fechas que necesitan revisión ({doubtful.length})</summary><ul>{doubtful.map(r => <li key={r.id}>{r.campus} · {r.encuentro} · {dateLabel(r.fecha)}: la fecha corresponde a {r.diaFecha.toLowerCase()}. {(data?.reportes ?? []).some(row => row.id === r.id && row.puedeEditar) && <Link className="ml-2 underline" href={`${STATS_ROOT}/registrar?editar=${encodeURIComponent(r.id!)}`}>Revisar fecha</Link>}</li>)}</ul></details>}
      <details className="stats-control-method"><summary>Seguimiento por campus y criterio de cálculo</summary><p>Comparamos los horarios vigentes con los reportes diarios, desde la semana del último reporte histórico de cada campus hasta hoy. Registrar una semana nueva no elimina faltantes anteriores. Los encuentros de hoy aparecen dos horas después de su inicio, con corte horario de Chile. Son pendientes según agenda: confirma suspensiones o cambios de horario antes de completar datos.</p><p>Los históricos con solo mes conocido no cubren un encuentro diario. “Por revisar” y “Observado” ya tienen reporte, pero aún no alimentan los indicadores.</p><ul>{selected.map(c => <li key={c.campusId}><strong>{c.campus}</strong><span>Seguimiento desde {c.desde ? dateLabel(c.desde) : 'sin fecha'} · Último reporte: {c.ultimoReporte ? dateLabel(c.ultimoReporte) : 'sin reportes'}</span></li>)}</ul></details>
    </>}
  </div>;
}
