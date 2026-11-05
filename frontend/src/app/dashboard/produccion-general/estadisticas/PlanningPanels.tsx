'use client';

import { useState } from 'react';
import Link from 'next/link';
import { campusProjection } from '@/lib/statistics-planning';
import { STATS_ROOT } from '@/lib/statistics-navigation';
import type { StatsResponse } from './EstadisticasClient';

const number = (value: number) => value.toLocaleString('es-CL');
const panel = 'rounded-2xl border border-slate-200 bg-white p-5';
const prettyDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
function recordDate(row: StatsResponse['records'][number]) {
  return row.fechaPrecision === 'mes' ? `${(row.periodo ?? row.fecha).slice(0, 7)} (solo mes)` : prettyDate(row.fecha);
}

export function ProjectionsPanel({ data }: { data: StatsResponse }) {
  const [variation, setVariation] = useState(10);
  const start = new Date(`${data.meta.to}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 27);
  return <section aria-label="Proyecciones por campus" className="space-y-5">
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
      <h2 className="text-lg font-bold text-slate-900">Planifica las próximas cuatro semanas</h2>
      <p className="mt-1 text-sm font-semibold text-violet-800">{prettyDate(start.toISOString().slice(0, 10))} — {prettyDate(end.toISOString().slice(0, 10))}</p>
      <p className="mt-3 text-sm text-slate-700">Base: mediana de la asistencia semanal registrada en las últimas ocho semanas cerradas, multiplicada por cuatro. Se requieren al menos seis semanas con reportes y registros en las dos más recientes. Solo encuentros con día conocido; se excluyen eventos y registros mensuales.</p>
      <label className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-800">Variación para los escenarios
        <select aria-label="Variación de escenarios" value={variation} onChange={e => setVariation(Number(e.target.value))} className="rounded-xl border border-violet-200 bg-white px-3 py-2.5">
          {[5, 10, 15, 20].map(value => <option key={value} value={value}>±{value}%</option>)}
        </select>
      </label>
      <p className="mt-3 text-xs text-slate-600">Son escenarios de planificación, no una predicción garantizada ni un intervalo estadístico de confianza. Suponen frecuencia de encuentros similar. No estiman personas únicas, aforo ni audiencia online. Las semanas sin reportes se omiten, no se rellenan con cero; los reportes faltantes pueden sesgar la base.</p>
      {data.meta.excludedReports > 0 && <p className="mt-3 text-sm font-semibold text-amber-900">Hay {data.meta.excludedReports} reportes por subir en la ventana de cálculo. Revisa los pendientes antes de usar estos escenarios.</p>}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">{data.byCampus.filter(c => c.isActive).map(c => {
      const estimate = campusProjection(data.records, c.campusId, data.meta);
      const max = Math.max(1, ...estimate.weeks.map(w => w.attendance));
      return <article key={c.campusId} className={panel}>
        <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs text-slate-500">{c.country}</p><h3 className="font-bold text-slate-900">{c.campusName}</h3></div><span className="text-xs text-slate-600">{estimate.observedWeeks}/8 semanas con reportes</span></div>
        <div className="my-4 flex h-20 items-end gap-2" aria-label={`Asistencia semanal registrada de ${c.campusName}`}>
          {estimate.weeks.map(w => <div key={w.from} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Semana del ${w.from}: ${w.reports ? number(w.attendance) + ' asistencias; ' + w.reports + ' reportes' : 'sin reportes'}`}>
            <div className={w.reports ? 'rounded-t bg-violet-400' : 'rounded-t border border-dashed border-amber-500'} style={{ height: w.reports ? Math.max(4, w.attendance / max * 60) : 8 }} />
            <span className="mt-1 text-center text-[10px] text-slate-600">{w.from.slice(8)}/{w.from.slice(5, 7)}</span>
          </div>)}
        </div>
        <p className="text-xs text-slate-600">{estimate.reports} encuentros utilizados · Promedio registrado por encuentro: {estimate.averagePerMeeting === null ? 'Sin dato' : number(estimate.averagePerMeeting)}</p>
        {estimate.baseline === null ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Sin estimación disponible.</strong> {estimate.reason}</p> : <>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[[`Menor asistencia (−${variation}%)`, Math.round(estimate.baseline * (1 - variation / 100))], ['Base registrada', estimate.baseline], [`Mayor asistencia (+${variation}%)`, Math.round(estimate.baseline * (1 + variation / 100))]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-2 text-xl font-bold text-slate-900">{number(Number(value))}</dd></div>)}
          </dl><p className="mt-3 text-xs text-slate-500">Asistencias acumuladas estimadas en cuatro semanas. Valida horarios, campañas y cambios de operación antes de planificar recursos.</p>
        </>}
      </article>;
    })}</div>
    {!data.byCampus.some(c => c.isActive) && <p className={panel}>No hay campus activos para proyectar con estos filtros.</p>}
  </section>;
}

export function CoveragePanel({ data }: { data: StatsResponse }) {
  return <section aria-label="Cobertura de datos" className="space-y-5">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-bold text-slate-900">Histórico disponible, no necesariamente completo</h2>
      <p className="mt-2 text-sm text-slate-700">Los campos completos miden el llenado de los reportes incluidos, no garantizan que estén todos los encuentros ni que las cifras sean correctas. Un período sin reportes no significa cero asistentes.</p>
      <p className="mt-2 text-sm text-slate-700">Los registros de Asana pendientes de depuración que aún no se importaron no aparecen en esta cobertura ni en el contador operativo de reportes por subir.</p>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.byCampus.map(c => {
      const rows = data.records.filter(r => r.campusId === c.campusId).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const months = new Set(rows.map(r => (r.periodo ?? r.fecha).slice(0, 7)));
      const monthly = rows.filter(r => r.fechaPrecision === 'mes').length;
      return <article key={c.campusId} className={panel}><p className="text-xs text-slate-500">{c.country}{!c.isActive ? ' · Inactivo' : ''}</p><h3 className="mt-1 font-bold">{c.campusName}</h3>
        <dl className="mt-4 space-y-2 text-sm"><div><dt className="text-slate-500">Primer registro en el filtro</dt><dd>{rows[0] ? recordDate(rows[0]) : 'Sin datos'}</dd></div><div><dt className="text-slate-500">Último registro en el filtro</dt><dd>{rows.length ? recordDate(rows[rows.length - 1]) : 'Sin datos'}</dd></div></dl>
        <p className="mt-4 text-xs text-slate-600">{rows.length} reportes · {months.size} meses con algún registro · {monthly} reportes sin día conocido.</p>
        <p className="mt-2 text-xs text-slate-500">Tener registros en un mes no confirma su cobertura completa.</p>
      </article>;
    })}</div>
  </section>;
}
