'use client';

import Link from 'next/link';
import { useMyDisponibilidad, useEncounters } from '@/hooks/useDisponibilidad';
import { useMyTecnicosDisponibilidad, useTecnicosEncounters } from '@/hooks/useTecnicos';
import { formatWeekLabel, toWeekLabel } from '@/types/disponibilidad';

export function AvailabilityTask({ campusId, channel }: {
  campusId: number | null; channel: 'worship' | 'tecnicos';
}) {
  const week = toWeekLabel(new Date());
  // Disabled queries must not call endpoints for an unrelated permission/channel.
  const worship = useMyDisponibilidad(channel === 'worship' ? campusId : null, week);
  const technicians = useMyTecnicosDisponibilidad(channel === 'tecnicos' ? campusId : null, week);
  const worshipSlots = useEncounters(channel === 'worship' ? campusId : null, week);
  const technicianSlots = useTecnicosEncounters(channel === 'tecnicos' ? campusId : null, week);
  const query = channel === 'worship' ? worship : technicians;
  const slots = channel === 'worship' ? worshipSlots : technicianSlots;
  const loading = query.isLoading || slots.isLoading;
  const failed = query.isError || slots.isError;
  const answered = new Set(query.data?.map(item => item.scheduleKey));
  const remaining = slots.data?.filter(slot => !answered.has(slot.scheduleKey)).length ?? 0;
  const noSchedule = !slots.data?.length;
  const href = channel === 'worship' ? '/dashboard/worship/disponibilidad'
    : '/dashboard/produccion-general/tecnicos/disponibilidad';
  return (
    <article className="rounded-2xl border border-white/15 bg-[#141414] p-5">
      <h3 className="text-base font-semibold text-white">Disponibilidad {channel === 'worship' ? 'Worship' : 'técnica'}</h3>
      <p className="mt-1 text-sm text-slate-300">Esta semana · {formatWeekLabel(week)}</p>
      {!campusId ? <>
        <p className="my-4 text-sm text-slate-300">Necesitas un campus asignado para enviar tu disponibilidad. Revisa tu perfil o contacta a tu responsable.</p>
        <Link href="/dashboard/perfil" className="dashboard-action">Revisar mi perfil →</Link>
      </> : loading ? <p className="my-4 text-sm text-slate-300" role="status">Consultando disponibilidad…</p>
        : failed ? <>
          <p className="my-4 text-sm text-amber-200" role="status">No pudimos consultar tu disponibilidad.</p>
          <button className="dashboard-action" onClick={() => { void query.refetch(); void slots.refetch(); }}>Reintentar</button>
        </> : <>
          <p className={`my-4 text-sm ${remaining ? 'text-amber-200' : 'text-emerald-200'}`}>
            {noSchedule ? 'Todavía no hay encuentros programados para esta semana.'
              : remaining ? `${remaining} encuentro${remaining === 1 ? '' : 's'} sin responder.`
                : 'Respondiste todos los encuentros de esta semana.'}
          </p>
          <Link href={href} className="dashboard-action">{remaining ? 'Enviar disponibilidad' : 'Ver disponibilidad'} →</Link>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">Indicar disponibilidad no confirma una asignación a un turno.</p>
        </>}
    </article>
  );
}
