'use client';

import Link from 'next/link';
import { useRevision } from '@/hooks/useRegistrosEncuentros';

/** Tarjeta de «Mis pendientes» para el administrador de campus: reportes que esperan su revisión. */
export function RevisionReportesTask() {
  const { data } = useRevision();
  if (!data?.campusIds.length) return null;
  const porRevisar = data.items.filter((r) => r.estado !== 'observado').length;
  const observados = data.items.length - porRevisar;

  return (
    <article className="rounded-2xl border border-[#dce5df] bg-white p-5">
      <h3 className="text-base font-semibold text-[#182d25]">Reportes por revisar</h3>
      <p className="mt-1 text-sm text-[#607068]">Reportes de encuentros que enviaron los líderes de voluntarios. Cuentan en Estadísticas cuando los subes.</p>
      <p className={`my-4 text-sm ${porRevisar ? 'text-amber-800' : 'text-emerald-800'}`}>
        {porRevisar ? `${porRevisar} ${porRevisar === 1 ? 'reporte espera' : 'reportes esperan'} tu revisión.` : 'No hay reportes por revisar.'}
        {observados > 0 && ` ${observados} ${observados === 1 ? 'está devuelto' : 'están devueltos'} esperando corrección.`}
      </p>
      <Link href="/dashboard/produccion-general/estadisticas/revisar" className="dashboard-action">Revisar reportes →</Link>
    </article>
  );
}
