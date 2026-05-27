'use client';

import { useState } from 'react';
import { useDisponibilidadMatrix } from '@/hooks/useDisponibilidad';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import { toWeekLabel } from '@/types/disponibilidad';

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

// ── Tokens oscuros (mismo tema que FichaDocumentView) ─────────────────────────

const D = {
  divider:    'rgba(255,255,255,0.06)',
  textMuted:  'rgba(255,255,255,0.25)',
  textSecond: 'rgba(255,255,255,0.4)',
  green:      '#1D9E75',
} as const;

// ── DisponibilidadPanel ───────────────────────────────────────────────────────

interface Props {
  fichaDate: any;
  activeRowLabel?: string;
  onSelectVolunteer: (name: string) => void;
}

export function DisponibilidadPanel({ fichaDate, activeRowLabel, onSelectVolunteer }: Props) {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();
  const { can, isAdmin } = usePermissions();

  const canView = isAdmin || can('disponibilidad:view');
  if (!canView) return null;

  const campusId  = open ? (user?.campusId ?? null) : null;
  const weekLabel = fichaDate ? toWeekLabel(parseDate(fichaDate)) : '';

  const { data: matrix, isLoading } = useDisponibilidadMatrix(campusId, weekLabel);

  const availableBySlot = (matrix?.encounters ?? []).map((enc) => ({
    enc,
    volunteers: (matrix?.volunteers ?? []).filter(
      (v) => v.slots[enc.scheduleKey]?.available,
    ),
  }));

  const totalAvailable = new Set(
    (matrix?.volunteers ?? [])
      .filter((v) => Object.values(v.slots).some((s) => s.available))
      .map((v) => v.userId),
  ).size;

  return (
    <div style={{ marginTop: 10, borderTop: `0.5px solid ${D.divider}`, paddingTop: 10 }}>
      {/* Botón toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, fontSize: 11, color: D.textSecond,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = D.textSecond; }}
      >
        {/* Icono calendario */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" />
        </svg>

        Ver disponibles esta semana

        {/* Badge con total cuando está cerrado */}
        {!open && !isLoading && totalAvailable > 0 && (
          <span style={{
            fontSize: 10, borderRadius: 10, padding: '1px 6px', fontWeight: 600,
            background: 'rgba(29,158,117,0.18)', color: D.green,
          }}>
            {totalAvailable}
          </span>
        )}

        {/* Chevron */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Hint sobre fila activa */}
      {open && activeRowLabel && (
        <p style={{ fontSize: 10, color: D.textMuted, margin: '6px 0 8px', fontStyle: 'italic' }}>
          Clic en un nombre para asignarlo a <strong style={{ color: D.textSecond }}>{activeRowLabel}</strong>
        </p>
      )}
      {open && !activeRowLabel && (
        <p style={{ fontSize: 10, color: D.textMuted, margin: '6px 0 8px' }}>
          Haz clic en una fila arriba y luego selecciona un voluntario
        </p>
      )}

      {/* Contenido del panel */}
      {open && (
        <div>
          {isLoading ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  height: 24, width: 72 + i * 10, borderRadius: 20,
                  background: 'rgba(255,255,255,0.06)',
                }} />
              ))}
            </div>
          ) : availableBySlot.length === 0 ? (
            <p style={{ fontSize: 11, color: D.textMuted, margin: 0 }}>
              Sin disponibilidades registradas para esta semana
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {availableBySlot.map(({ enc, volunteers }) => (
                <div key={enc.scheduleKey}>
                  {/* Encabezado del bloque */}
                  <p style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
                    letterSpacing: '0.1em', color: D.textMuted, margin: '0 0 5px',
                  }}>
                    {enc.dia}{enc.bloque ? ` ${enc.bloque}` : ''} · {enc.hora}
                  </p>

                  {/* Chips de voluntarios */}
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                    {volunteers.length === 0 ? (
                      <span style={{ fontSize: 11, color: D.textMuted }}>Sin respuestas</span>
                    ) : (
                      volunteers.map((v) => {
                        const nota = v.slots[enc.scheduleKey]?.nota;
                        return (
                          <button
                            key={v.userId}
                            title={nota ? `Nota: ${nota}` : 'Clic para asignar'}
                            onClick={() => onSelectVolunteer(v.userName)}
                            disabled={!activeRowLabel}
                            style={{
                              fontSize: 11, fontWeight: 500,
                              background: activeRowLabel
                                ? 'rgba(29,158,117,0.12)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${activeRowLabel ? 'rgba(29,158,117,0.22)' : 'rgba(255,255,255,0.08)'}`,
                              color: activeRowLabel ? D.green : D.textSecond,
                              borderRadius: 20, padding: '3px 10px',
                              cursor: activeRowLabel ? 'pointer' : 'default',
                              transition: 'all 0.12s',
                            }}
                            onMouseEnter={(e) => {
                              if (!activeRowLabel) return;
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(29,158,117,0.22)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(29,158,117,0.4)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = activeRowLabel
                                ? 'rgba(29,158,117,0.12)' : 'rgba(255,255,255,0.04)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = activeRowLabel
                                ? 'rgba(29,158,117,0.22)' : 'rgba(255,255,255,0.08)';
                            }}
                          >
                            {v.userName}
                            {nota && (
                              <span style={{ marginLeft: 4, opacity: 0.55, fontSize: 10 }} title={nota}>·ℹ</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
