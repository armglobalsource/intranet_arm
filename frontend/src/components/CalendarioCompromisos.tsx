'use client';

import { useState, useMemo } from 'react';
import type { DisponibilidadDoc } from '@/types/disponibilidad';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEncounterDate(raw: any): Date | null {
  if (!raw) return null;
  // Firestore Timestamp { seconds, nanoseconds }
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  if (typeof raw === 'string') return new Date(raw);
  if (raw instanceof Date) return raw;
  return null;
}

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CommitmentEntry {
  doc:     DisponibilidadDoc;
  channel: 'worship' | 'tecnicos';
}

interface Props {
  worshipCommitments:  DisponibilidadDoc[];
  tecnicosCommitments: DisponibilidadDoc[];
  loading?:            boolean;
}

// ── CalendarioCompromisos ─────────────────────────────────────────────────────

export function CalendarioCompromisos({ worshipCommitments, tecnicosCommitments, loading }: Props) {
  const today       = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [expanded, setExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Mapa dateKey → compromisos
  const commitmentMap = useMemo(() => {
    const map = new Map<string, CommitmentEntry[]>();
    const add = (docs: DisponibilidadDoc[], channel: 'worship' | 'tecnicos') => {
      for (const doc of docs) {
        const date = parseEncounterDate(doc.encounterDate);
        if (!date) continue;
        const key = toDateKey(date);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ doc, channel });
      }
    };
    add(worshipCommitments,  'worship');
    add(tecnicosCommitments, 'tecnicos');
    return map;
  }, [worshipCommitments, tecnicosCommitments]);

  // Navegar mes
  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  // Calcular días del mes en cuadrícula L-D
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Day-of-week en L=0…D=6
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toDateKey(today);

  function dayKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedEntries = selectedDay ? (commitmentMap.get(selectedDay) ?? []) : [];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-xs font-bold text-gray-700">Mis compromisos</span>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Vista resumida' : 'Vista ampliada'}
          className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-200"
        >
          {expanded ? '▲ Resumir' : '▼ Ampliar'}
        </button>
      </div>

      {/* ── Navegación de mes ── */}
      <div className="flex items-center justify-between px-4 pb-2">
        <button onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTHS_ES[month]} {year}
        </span>
        <button onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ── Cabecera días ── */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-[9px] font-bold text-gray-400 uppercase py-1">{d}</div>
        ))}
      </div>

      {/* ── Cuadrícula de días ── */}
      {loading ? (
        <div className="px-3 pb-3">
          <div className="h-28 rounded-xl bg-gray-200 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px px-3 pb-3">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const key      = dayKey(day);
            const entries  = commitmentMap.get(key) ?? [];
            const isToday  = key === todayKey;
            const isSelected = selectedDay === key;
            const hasW     = entries.some(e => e.channel === 'worship');
            const hasT     = entries.some(e => e.channel === 'tecnicos');
            const isPast   = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(selectedDay === key ? null : key)}
                className="relative flex flex-col items-center justify-start rounded-lg transition-all"
                style={{
                  padding:    expanded ? '6px 2px' : '3px 2px',
                  minHeight:  expanded ? 52 : 32,
                  background: isSelected ? '#1F2937' : isToday ? '#F0FDF4' : 'transparent',
                  border:     isToday ? '1px solid #BBF7D0' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isToday ? '#F0FDF4' : 'transparent'; }}
              >
                {/* Número */}
                <span className="text-[11px] font-semibold leading-none" style={{
                  color: isSelected ? '#fff' : isToday ? '#16a34a' : isPast ? '#D1D5DB' : '#374151',
                }}>
                  {day}
                </span>

                {/* Puntos de compromiso */}
                {entries.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {hasW && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: isSelected ? '#86EFAC' : '#16a34a' }} />
                    )}
                    {hasT && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: isSelected ? '#93C5FD' : '#2563eb' }} />
                    )}
                  </div>
                )}

                {/* Vista ampliada: etiquetas */}
                {expanded && entries.length > 0 && (
                  <div className="w-full mt-1 flex flex-col gap-0.5 px-0.5">
                    {entries.map((e, idx) => (
                      <div key={idx} className="rounded text-[7px] font-semibold truncate px-1 leading-tight py-px"
                        style={{
                          background: e.channel === 'worship' ? 'rgba(22,163,74,0.12)' : 'rgba(37,99,235,0.12)',
                          color:      e.channel === 'worship' ? '#15803d' : '#1d4ed8',
                        }}>
                        {e.doc.bloque ?? e.doc.hora.split('·')[0].trim()}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Detalle del día seleccionado ── */}
      {selectedDay && selectedEntries.length > 0 && (
        <div style={{ borderTop: '1px solid #E5E7EB', padding: '10px 12px 12px' }}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="flex flex-col gap-1.5">
            {selectedEntries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{
                  background: entry.channel === 'worship' ? 'rgba(22,163,74,0.07)' : 'rgba(37,99,235,0.07)',
                  border:     `1px solid ${entry.channel === 'worship' ? 'rgba(22,163,74,0.2)' : 'rgba(37,99,235,0.2)'}`,
                }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: entry.channel === 'worship' ? '#16a34a' : '#2563eb' }} />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold"
                    style={{ color: entry.channel === 'worship' ? '#15803d' : '#1d4ed8' }}>
                    {entry.channel === 'worship' ? 'AR Worship' : 'Técnicos'}
                  </span>
                  {entry.doc.bloque && (
                    <span className="text-[10px] text-gray-500 ml-1.5">{entry.doc.bloque}</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-1.5">{entry.doc.hora} hrs</span>
                </div>
                {entry.doc.nota && (
                  <span className="text-[9px] text-gray-400 truncate max-w-[70px]" title={entry.doc.nota}>
                    {entry.doc.nota}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Leyenda ── */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        {worshipCommitments.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[9px] text-gray-500">Worship</span>
          </div>
        )}
        {tecnicosCommitments.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[9px] text-gray-500">Técnicos</span>
          </div>
        )}
        {worshipCommitments.length === 0 && tecnicosCommitments.length === 0 && !loading && (
          <span className="text-[9px] text-gray-400">Sin compromisos registrados</span>
        )}
      </div>
    </div>
  );
}
