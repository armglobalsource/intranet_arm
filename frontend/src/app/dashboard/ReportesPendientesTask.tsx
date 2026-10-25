'use client';

import Link from 'next/link';
import { usePendientesReporte } from '@/hooks/useRegistrosEncuentros';

function shortDate(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Tarjeta de «Mis pendientes»: encuentros de las últimas dos semanas que el campus aún no reporta. */
export function ReportesPendientesTask() {
  const { data, isLoading, isError, refetch } = usePendientesReporte();
  const pendientes = data?.pendientes ?? [];
  const revisar = data?.revisar ?? [];
  const href = (p: { fecha: string; encuentro: string; campusId: number }) =>
    `/dashboard/produccion-general/estadisticas/registrar?fecha=${p.fecha}&encuentro=${encodeURIComponent(p.encuentro)}&campus=${p.campusId}`;

  return (
    <article className="rounded-2xl border border-white/15 bg-[#141414] p-5">
      <h3 className="text-base font-semibold text-white">Encuentros por reportar</h3>
      <p className="mt-1 text-sm text-slate-300">Encuentros de las últimas dos semanas que todavía no tienen estadísticas.</p>
      {isLoading ? <p role="status" className="my-4 text-sm text-slate-300">Revisando los reportes…</p>
        : isError ? <div className="my-4"><p className="mb-3 text-sm text-amber-200">No pudimos revisar los reportes.</p><button className="dashboard-action" onClick={() => void refetch()}>Reintentar</button></div>
        : pendientes.length === 0 ? <p className="my-4 text-sm text-emerald-200">Todos los encuentros recientes están reportados.</p>
        : <ul className="my-3 divide-y divide-white/10">
          {pendientes.slice(0, 4).map((p) => (
            <li key={`${p.campusId}-${p.fecha}-${p.hora}`}>
              <Link href={href(p)} className="flex min-h-[56px] items-center justify-between gap-3 rounded-lg py-2.5 hover:bg-white/5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{p.encuentro}</p>
                  <p className="mt-0.5 text-sm capitalize text-slate-300">{shortDate(p.fecha)} · {p.campus}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-emerald-300">Registrar →</span>
              </Link>
            </li>
          ))}
        </ul>}
      {revisar.length > 0 && (
        <p className="mb-3 text-sm text-amber-200">{revisar.length === 1 ? 'Hay 1 registro' : `Hay ${revisar.length} registros`} con una fecha que no calza con el día del encuentro.</p>
      )}
      <Link href="/dashboard/produccion-general/estadisticas/registrar" className="dashboard-action">
        Registrar encuentro{pendientes.length > 4 ? ` (${pendientes.length} pendientes)` : ''} →
      </Link>
    </article>
  );
}
