'use client';

import { useState } from 'react';
import { useTecnicosMatrix } from '@/hooks/useTecnicos';
import { usePermissions } from '@/hooks/usePermissions';
import { toWeekLabel, formatWeekLabel } from '@/types/disponibilidad';
import { parseFichaDate } from '@/lib/ficha-date';

interface Props {
  fichaDate: any;
  campusId: number | null;
}

export function TecnicosDisponibilidadSideCard({ fichaDate, campusId }: Props) {
  const { can, isAdmin } = usePermissions();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canView = isAdmin || can('tecnicos:view');
  if (!canView) return null;

  const date      = fichaDate ? parseFichaDate(fichaDate) : new Date();
  const weekLabel = toWeekLabel(date);

  const { data: matrix, isLoading } = useTecnicosMatrix(campusId, weekLabel);

  if (!campusId) {
    return (
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-900 mb-1">Técnicos disponibles</p>
        <p className="text-[10px] text-gray-400 mt-2">Sin campus asignado en tu perfil</p>
      </div>
    );
  }

  const availableBySlot = (matrix?.encounters ?? []).map((enc) => ({
    enc,
    tecnicos: (matrix?.tecnicos ?? []).filter(
      (t) => t.slots[enc.scheduleKey]?.available,
    ),
  })).filter(({ tecnicos }) => tecnicos.length > 0);

  const totalAvailable = new Set(
    (matrix?.tecnicos ?? [])
      .filter((t) => Object.values(t.slots).some((s) => s.available))
      .map((t) => t.userId),
  ).size;

  function copyName(userId: number, name: string) {
    const key = String(userId);
    const done = () => { setCopiedId(key); setTimeout(() => setCopiedId(null), 1800); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(name).then(done).catch(() => fallback(name, done));
    } else { fallback(name, done); }
  }

  function fallback(name: string, onDone: () => void) {
    const ta = document.createElement('textarea');
    ta.value = name; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); onDone(); } catch {}
    document.body.removeChild(ta);
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold text-gray-900 leading-tight">Técnicos disponibles</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{formatWeekLabel(weekLabel)}</p>
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed" style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
        Clic en un nombre para copiarlo al portapapeles
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[70, 90, 60, 80].map((w, i) => (
            <div key={i} className="h-3 rounded-full animate-pulse bg-gray-100" style={{ width: w }} />
          ))}
        </div>
      ) : availableBySlot.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-[11px] text-gray-400">Sin disponibilidades técnicas</p>
          <p className="text-[10px] text-gray-300 mt-1">para esta semana</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {availableBySlot.map(({ enc, tecnicos }) => (
            <div key={enc.scheduleKey}>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                {enc.dia}{enc.bloque ? ` ${enc.bloque}` : ''} · {enc.hora}
              </p>
              <div className="flex flex-col gap-1">
                {tecnicos.map((t) => {
                  const nota   = t.slots[enc.scheduleKey]?.nota;
                  const key    = String(t.userId);
                  const copied = copiedId === key;
                  return (
                    <button key={t.userId} title={nota ? `Nota: ${nota}` : 'Clic para copiar nombre'}
                      onClick={() => copyName(t.userId, t.userName)}
                      className="flex items-center justify-between w-full text-left rounded-lg px-2.5 py-1.5 transition-all"
                      style={{ background: copied ? 'rgba(37,99,235,0.08)' : '#F9FAFB', border: `1px solid ${copied ? 'rgba(37,99,235,0.2)' : '#F3F4F6'}` }}
                      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.background = '#F3F4F6'; }}
                      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = '#F9FAFB'; }}>
                      <span className="text-[11px] font-medium text-gray-700 truncate">{t.userName}</span>
                      {copied ? <span className="text-[9px] font-semibold text-blue-600 flex-shrink-0 ml-1">✓</span>
                        : nota ? <span className="text-[9px] text-gray-300 flex-shrink-0 ml-1" title={nota}>·</span>
                        : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && totalAvailable > 0 && (
        <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
          <p className="text-[10px] text-gray-400 text-center">
            <span className="font-semibold text-gray-600">{totalAvailable}</span> técnicos disponibles
          </p>
        </div>
      )}
    </div>
  );
}
