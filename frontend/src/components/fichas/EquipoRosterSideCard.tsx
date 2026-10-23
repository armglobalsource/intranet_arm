'use client';

import { useState } from 'react';
import type { RosterResult, RosterPerson, RosterStatus } from '@/types/disponibilidad';
import { formatWeekLabel } from '@/types/disponibilidad';

interface Props {
  roster:    RosterResult | undefined;
  isLoading: boolean;
  weekLabel: string;
  campusId:  number | null;
}

const STATUS_COLOR: Record<RosterStatus, string> = {
  disponible:    '#1D9E75',
  no_disponible: '#D14343',
  sin_responder: '#6b6b6b',
};

const GROUPS: { key: keyof RosterResult; label: string }[] = [
  { key: 'worship', label: 'Worship' },
  { key: 'tecnico', label: 'Equipo técnico' },
  { key: 'ninguno', label: 'Ningún equipo' },
];

export function EquipoRosterSideCard({ roster, isLoading, weekLabel, campusId }: Props) {
  // Sobre la ficha (pantallas angostas) arranca plegado para no tapar la ficha;
  // al costado (xl) siempre se muestra completo.
  const [open, setOpen] = useState(false);
  const available = GROUPS.reduce((total, { key }) =>
    total + (roster?.[key] ?? []).filter((p: RosterPerson) => p.status === 'disponible').length, 0);

  if (!campusId) {
    return (
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-900 mb-1">Equipo</p>
        <p className="text-[10px] text-gray-400 mt-2">Sin campus asignado en tu perfil</p>
      </div>
    );
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-900 leading-tight">Equipo</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {formatWeekLabel(weekLabel)}
            {!isLoading && roster && <span className="xl:hidden"> · {available} disponible{available === 1 ? '' : 's'}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-h-[36px] shrink-0 rounded-lg border border-gray-200 px-3 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 xl:hidden"
        >
          {open ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      <div className={`${open ? 'flex' : 'hidden'} flex-col gap-3 xl:flex`}>
      {/* Leyenda */}
      <div className="flex items-center gap-3 flex-wrap" style={{ borderTop: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', padding: '8px 0' }}>
        {(['disponible', 'no_disponible', 'sin_responder'] as RosterStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[s] }} />
            <span className="text-[9px] text-gray-400">
              {s === 'disponible' ? 'Disponible' : s === 'no_disponible' ? 'No disponible' : 'Sin responder'}
            </span>
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[70, 90, 60, 80].map((w, i) => (
            <div key={i} className="h-3 rounded-full animate-pulse bg-gray-100" style={{ width: w }} />
          ))}
        </div>
      ) : (
        <div className="flex max-h-[320px] flex-col gap-4 overflow-y-auto pr-1 xl:max-h-[calc(100vh-260px)]">
          {GROUPS.map(({ key, label }) => {
            const people = roster?.[key] ?? [];
            if (people.length === 0) return null;
            return (
              <div key={key}>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                  {label} · {people.length}
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
                  {people.map((p: RosterPerson) => (
                    <div
                      key={p.userId}
                      className="flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5"
                      style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}
                    >
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[p.status], flexShrink: 0 }} />
                      <span className="text-[11px] font-medium text-gray-700 truncate flex-1">{p.userName}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
