'use client';

import { useState } from 'react';
import type { RosterResult, RosterPerson, RosterStatus } from '@/types/disponibilidad';
import { formatWeekLabel } from '@/types/disponibilidad';

interface Props {
  roster: RosterResult | undefined;
  isLoading: boolean;
  weekLabel: string;
  campusId: number | null;
}

const STATUS_COLOR: Record<RosterStatus, string> = {
  disponible: '#1D9E75',
  no_disponible: '#D14343',
  sin_responder: '#6b6b6b',
};

const GROUPS: { key: keyof RosterResult; label: string }[] = [
  { key: 'worship', label: 'Worship' },
  { key: 'tecnico', label: 'Equipo técnico' },
  { key: 'ninguno', label: 'Sin equipo asignado' },
];

function StatusSummary({ label, value, color, bordered }: { label: string; value: number; color: string; bordered?: boolean }) {
  return (
    <div className={`px-2 py-2.5 text-center ${bordered ? 'border-l border-slate-200' : ''}`}>
      <p className="text-sm font-bold text-slate-800">{value}</p>
      <p className="mt-0.5 flex items-center justify-center gap-1 whitespace-nowrap text-[9px] font-medium text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </p>
    </div>
  );
}

export function EquipoRosterSideCard({ roster, isLoading, weekLabel, campusId }: Props) {
  // En pantallas angostas se pliega para preservar espacio de edición; en xl se
  // mantiene abierto porque acompaña a la ficha como referencia de asignación.
  const [open, setOpen] = useState(false);
  const count = (status: RosterStatus) => GROUPS.reduce(
    (total, { key }) => total + (roster?.[key] ?? []).filter((person: RosterPerson) => person.status === status).length,
    0,
  );
  const available = count('disponible');
  const unavailable = count('no_disponible');
  const pending = count('sin_responder');
  const total = available + unavailable + pending;

  if (!campusId) {
    return (
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">Equipo de la semana</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Sin campus asignado en tu perfil.</p>
      </aside>
    );
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 px-4 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">Equipo de la semana</p>
          <p className="mt-1 text-[11px] text-slate-500">{formatWeekLabel(weekLabel)}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="m-3 min-h-[34px] shrink-0 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 xl:hidden"
        >
          {open ? 'Ocultar' : 'Ver equipo'}
        </button>
      </div>

      {!isLoading && roster && (
        <div className="mx-4 mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          <StatusSummary label="Disponible" value={available} color={STATUS_COLOR.disponible} />
          <StatusSummary label="No puede" value={unavailable} color={STATUS_COLOR.no_disponible} bordered />
          <StatusSummary label="Pendiente" value={pending} color={STATUS_COLOR.sin_responder} bordered />
        </div>
      )}

      <div className={`${open ? 'flex' : 'hidden'} flex-col xl:flex`}>
        <div className="mx-4 mt-4 flex items-center justify-between border-b border-slate-100 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">Personas · {total}</p>
          <p className="text-[10px] text-slate-400">Disponibilidad</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {[70, 90, 60, 80].map((width, index) => (
              <div key={index} className="h-3 animate-pulse rounded-full bg-slate-100" style={{ width }} />
            ))}
          </div>
        ) : (
          <div className="flex max-h-[320px] flex-col gap-4 overflow-y-auto px-4 py-4 xl:max-h-[calc(100vh-315px)]">
            {GROUPS.map(({ key, label }) => {
              const people = roster?.[key] ?? [];
              if (!people.length) return null;
              return (
                <div key={key}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">{label} · {people.length}</p>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
                    {people.map((person: RosterPerson) => (
                      <div key={person.userId} className="flex w-full items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[person.status] }} />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{person.userName}</span>
                        <span className="shrink-0 text-[9px] font-medium text-slate-400">
                          {person.status === 'disponible' ? 'Sí' : person.status === 'no_disponible' ? 'No' : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
