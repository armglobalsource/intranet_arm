'use client';

import { useState } from 'react';
import { useDisponibilidadMatrix } from '@/hooks/useDisponibilidad';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import { toWeekLabel, formatWeekLabel } from '@/types/disponibilidad';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(raw: any): Date {
  if (typeof raw?.toDate === 'function') return raw.toDate();
  if (raw instanceof Date) return raw;
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(raw);
}

// ── DisponibilidadSideCard ────────────────────────────────────────────────────

interface Props {
  fichaDate: any;
}

export function DisponibilidadSideCard({ fichaDate }: Props) {
  const { user } = useAuthStore();
  const { can, isAdmin } = usePermissions();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canView = isAdmin || can('disponibilidad:view');
  if (!canView) return null;

  const campusId  = user?.campusId ?? null;
  const date      = fichaDate ? parseDate(fichaDate) : new Date();
  const weekLabel = toWeekLabel(date);

  const { data: matrix, isLoading } = useDisponibilidadMatrix(campusId, weekLabel);

  if (!campusId) {
    return (
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-900 mb-1">Disponibles esta semana</p>
        <p className="text-[10px] text-gray-400 mt-2">Sin campus asignado en tu perfil</p>
      </div>
    );
  }

  const availableBySlot = (matrix?.encounters ?? []).map((enc) => ({
    enc,
    volunteers: (matrix?.volunteers ?? []).filter(
      (v) => v.slots[enc.scheduleKey]?.available,
    ),
  })).filter(({ volunteers }) => volunteers.length > 0);

  const totalAvailable = new Set(
    (matrix?.volunteers ?? [])
      .filter((v) => Object.values(v.slots).some((s) => s.available))
      .map((v) => v.userId),
  ).size;

  function copyName(userId: number, name: string) {
    const key = String(userId);
    const done = () => {
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(name).then(done).catch(() => fallback(name, done));
    } else {
      fallback(name, done);
    }
  }

  function fallback(name: string, onDone: () => void) {
    const ta = document.createElement('textarea');
    ta.value = name;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); onDone(); } catch {}
    document.body.removeChild(ta);
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-gray-900 leading-tight">Disponibles esta semana</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{formatWeekLabel(weekLabel)}</p>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-gray-400 leading-relaxed" style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
        Clic en un nombre para copiarlo al portapapeles
      </p>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[70, 90, 60, 80].map((w, i) => (
            <div key={i} className="h-3 rounded-full animate-pulse bg-gray-100" style={{ width: w }} />
          ))}
        </div>
      ) : availableBySlot.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-[11px] text-gray-400">Sin disponibilidades</p>
          <p className="text-[10px] text-gray-300 mt-1">para esta semana</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {availableBySlot.map(({ enc, volunteers }) => (
            <div key={enc.scheduleKey}>
              {/* Bloque horario */}
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                {enc.dia}{enc.bloque ? ` ${enc.bloque}` : ''} · {enc.hora}
              </p>

              {/* Chips de voluntarios */}
              <div className="flex flex-col gap-1">
                {volunteers.map((v) => {
                  const nota  = v.slots[enc.scheduleKey]?.nota;
                  const key   = String(v.userId);
                  const copied = copiedId === key;
                  return (
                    <button
                      key={v.userId}
                      title={nota ? `Nota: ${nota}` : 'Clic para copiar nombre'}
                      onClick={() => copyName(v.userId, v.userName)}
                      className="flex items-center justify-between w-full text-left rounded-lg px-2.5 py-1.5 transition-all"
                      style={{
                        background: copied ? 'rgba(29,158,117,0.08)' : '#F9FAFB',
                        border:     `1px solid ${copied ? 'rgba(29,158,117,0.2)' : '#F3F4F6'}`,
                      }}
                      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.background = '#F3F4F6'; }}
                      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = '#F9FAFB'; }}
                    >
                      <span className="text-[11px] font-medium text-gray-700 truncate">
                        {v.userName}
                      </span>
                      {copied ? (
                        <span className="text-[9px] font-semibold text-green-600 flex-shrink-0 ml-1">✓</span>
                      ) : nota ? (
                        <span className="text-[9px] text-gray-300 flex-shrink-0 ml-1" title={nota}>·</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer con total */}
      {!isLoading && totalAvailable > 0 && (
        <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
          <p className="text-[10px] text-gray-400 text-center">
            <span className="font-semibold text-gray-600">{totalAvailable}</span> voluntarios disponibles
          </p>
        </div>
      )}
    </div>
  );
}
