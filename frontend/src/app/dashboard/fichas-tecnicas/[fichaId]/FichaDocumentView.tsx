'use client';

import type { Ficha, Row, SectionName, Encuentro } from '@/types/ficha';

// ── Paleta ────────────────────────────────────────────────────────────────────

const C = {
  purple: '#7F77DD',
  green:  '#1D9E75',
  amber:  '#BA7517',
  gray:   '#888780',
} as const;

const SONG_DOT_COLORS = [C.purple, C.green, C.green, C.green, C.amber, C.gray];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw: any): string {
  if (!raw) return '—';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (raw instanceof Date)           d = raw;
  else if (raw?.seconds)                  d = new Date(raw.seconds * 1000);
  else                                    d = new Date(raw);
  return d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, (c) => c.toUpperCase());
}

/** Lee el valor de una fila según el encuentro activo */
function val(row: Row, colId: string): string {
  if (row.shared) return (row.values?.['shared'] ?? row.values?.[colId] ?? '').trim();
  return (row.values?.[colId] ?? '').trim();
}

/** Filtra filas que tengan valor real */
function rowsWithVal(rows: Row[], colId: string) {
  return [...rows].sort((a, b) => a.order - b.order).filter((r) => val(r, colId));
}

/** Color de barra para horarios según label */
function timelineColor(label: string): { color: string; opacity: number } {
  const l = label.toLowerCase();
  if (/worship|vio|arw/.test(l))        return { color: C.purple, opacity: 1 };
  if (/predica/.test(l))                return { color: C.amber,  opacity: 0.85 };
  if (/inicio|opening|start/.test(l))   return { color: C.green,  opacity: 1 };
  return { color: C.gray, opacity: 0.4 };
}

// ── Estilos base reutilizables ─────────────────────────────────────────────────

const S = {
  card: {
    background: '#fff',
    border: '0.5px solid rgba(0,0,0,0.1)',
    borderRadius: 12,
    padding: '1rem 1.1rem',
    marginBottom: 14,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', color: '#9c9a92', marginBottom: 10,
  } as React.CSSProperties,
  roleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  roleLabel: { fontSize: 12, color: '#5f5e5a' } as React.CSSProperties,
  roleValue: {
    fontSize: 13, fontWeight: 500, color: '#1a1a18',
    textAlign: 'right' as const, maxWidth: '58%',
  } as React.CSSProperties,
};

// ── RoleCard — Pastoral / Producción genérico ─────────────────────────────────

function RoleCard({
  title, rows, colId,
}: { title: string; rows: Row[]; colId: string }) {
  const filtered = rowsWithVal(rows, colId);
  if (!filtered.length) return null;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      {filtered.map((row, i) => (
        <div key={row.id} style={{ ...S.roleRow, ...(i === filtered.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}) }}>
          <span style={S.roleLabel}>{row.label}</span>
          <span style={S.roleValue}>{val(row, colId)}</span>
        </div>
      ))}
    </div>
  );
}

// ── StreamingCard ─────────────────────────────────────────────────────────────

function StreamingCard({ rows, colId }: { rows: Row[]; colId: string }) {
  const all      = rowsWithVal(rows, colId);
  const director = all.filter((r) => /director|wirecast/i.test(r.label));
  const cameras  = all.filter((r) => /^cam\s?\d/i.test(r.label));
  const others   = all.filter((r) => !director.includes(r) && !cameras.includes(r));
  if (!all.length) return null;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Streaming</div>

      {[...director, ...others].map((row, i, arr) => (
        <div key={row.id} style={{ ...S.roleRow, ...(cameras.length === 0 && i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>
          <span style={S.roleLabel}>{row.label}</span>
          <span style={S.roleValue}>{val(row, colId)}</span>
        </div>
      ))}

      {cameras.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
          {cameras.map((row) => (
            <div key={row.id} style={{ background: '#f7f6f3', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {row.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18', marginTop: 2 }}>
                {val(row, colId)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EscenaCard — AR Worship / Banda ──────────────────────────────────────────

function EscenaCard({ rows, colId }: { rows: Row[]; colId: string }) {
  const all      = rowsWithVal(rows, colId);
  const vio      = all.find((r) => r.label === 'VIO');
  const positions = all.filter((r) => /posición|posicion/i.test(r.label));
  const musicians = all.filter((r) => r !== vio && !positions.includes(r));
  if (!all.length) return null;

  const half = Math.ceil(musicians.length / 2);
  const col1 = musicians.slice(0, half);
  const col2 = musicians.slice(half);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        AR Worship / Banda{vio ? ` — VIO: ${val(vio, colId)}` : ''}
      </div>

      {/* Posiciones en escena */}
      {positions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {positions.map((row) => {
            const posLabel = row.label.replace(/posición\s*/i, '');
            return (
              <div key={row.id} style={{
                flex: 1, textAlign: 'center', background: '#f7f6f3',
                borderRadius: 8, padding: '9px 4px', border: '0.5px solid rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 10, color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {posLabel}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18', marginTop: 3 }}>
                  {val(row, colId)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Músicos en 2 columnas */}
      {musicians.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          {[col1, col2].map((col, ci) => (
            <div key={ci}>
              {col.map((row, i) => (
                <div key={row.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '4px 0', borderBottom: i === col.length - 1 ? 'none' : '0.5px solid rgba(0,0,0,0.06)',
                }}>
                  <span style={{ fontSize: 11, color: '#9c9a92' }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{val(row, colId)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SetListCard ───────────────────────────────────────────────────────────────

function SetListCard({ rows, colId, encuentro }: { rows: Row[]; colId: string; encuentro: Encuentro | null }) {
  const songs = rowsWithVal(rows, colId);
  if (!songs.length) return null;
  const dotColor = encuentro?.color ?? C.purple;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Set List</div>
      {songs.map((row, i) => (
        <div key={row.id} style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '7px 0',
          borderBottom: i === songs.length - 1 ? 'none' : '0.5px solid rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: SONG_DOT_COLORS[i % SONG_DOT_COLORS.length],
          }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', flex: 1 }}>
            {val(row, colId)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── HorariosCard ──────────────────────────────────────────────────────────────

function HorariosCard({ rows, colId }: { rows: Row[]; colId: string }) {
  const items = rowsWithVal(rows, colId);
  if (!items.length) return null;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Horarios</div>
      {items.map((row) => {
        const time  = val(row, colId);
        const { color, opacity } = timelineColor(row.label);
        const isBold = /worship|vio|predicación|inicio/i.test(row.label);
        return (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
            <span style={{
              fontSize: 11, color: '#9c9a92', width: 38, textAlign: 'right',
              flexShrink: 0, fontVariantNumeric: 'tabular-nums',
              fontWeight: isBold ? 600 : 400, ...(isBold ? { color: '#1a1a18' } : {}),
            }}>
              {time}
            </span>
            <div style={{
              width: 3, height: 14, flexShrink: 0, borderRadius: 2,
              background: color, opacity,
            }} />
            <span style={{
              fontSize: 12, color: '#1a1a18', flex: 1,
              fontWeight: isBold ? 600 : 400,
            }}>
              {row.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── AnunciosCard ──────────────────────────────────────────────────────────────

function AnunciosCard({ rows, colId }: { rows: Row[]; colId: string }) {
  const items = rowsWithVal(rows, colId);
  if (!items.length) return null;

  return (
    <div style={{ ...S.card, marginBottom: 0 }}>
      <div style={S.cardTitle}>Info Encuentro</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
        {items.map((row, i) => (
          <div key={row.id} style={{
            padding: '5px 0',
            borderBottom: i < items.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
          }}>
            <div style={{ fontSize: 12, color: '#5f5e5a', lineHeight: 1.55 }}>
              <strong style={{ color: '#1a1a18', fontWeight: 600 }}>{row.label}: </strong>
              {val(row, colId)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VoluntariosCard ───────────────────────────────────────────────────────────

function VoluntariosCard({ rows, colId }: { rows: Row[]; colId: string }) {
  const items = rowsWithVal(rows, colId);
  if (!items.length) return null;
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.cardTitle}>Voluntarios de Servicio</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
        {items.map((row, i, arr) => (
          <div key={row.id} style={{
            ...S.roleRow,
            ...(i >= arr.length - 2 ? { borderBottom: 'none' } : {}),
          }}>
            <span style={S.roleLabel}>{row.label}</span>
            <span style={S.roleValue}>{val(row, colId)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── EncuentroTabs ─────────────────────────────────────────────────────────────

function EncuentroTabs({
  encuentros, selected, onChange,
}: { encuentros: Encuentro[]; selected: string; onChange: (id: string) => void }) {
  if (encuentros.length <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      {encuentros.map((e) => (
        <button
          key={e.id}
          onClick={() => onChange(e.id)}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1px solid',
            cursor: 'pointer', transition: 'all 0.15s',
            ...(selected === e.id
              ? { background: e.color ?? C.purple, color: '#fff', borderColor: e.color ?? C.purple }
              : { background: '#fff', color: '#5f5e5a', borderColor: 'rgba(0,0,0,0.12)' }),
          }}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}

// ── FichaDocumentView — componente principal ──────────────────────────────────

interface Props {
  ficha:  Ficha;
  onEdit: () => void;
}

export function FichaDocumentView({ ficha, onEdit }: Props) {
  const { sections, encuentros, campusName, title, date, type } = ficha;

  // Encuentro activo (primer encuentro por defecto)
  const [selectedId, setSelectedId] = React.useState<string>(
    encuentros?.[0]?.id ?? 'unico',
  );

  const selectedEncuentro = encuentros?.find((e) => e.id === selectedId) ?? null;
  const colId = selectedId;

  // Secciones con filas
  const sec = (name: SectionName) => sections?.[name]?.rows ?? [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Encuentro tabs (multi-encuentro) */}
      <EncuentroTabs
        encuentros={encuentros ?? []}
        selected={selectedId}
        onChange={setSelectedId}
      />

      {/* Documento */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '0.5px solid rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '1.5rem 2rem 1.25rem',
          borderBottom: '0.5px solid rgba(0,0,0,0.1)',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>
              arm global — Campus {campusName}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1a1a18' }}>{title}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18' }}>{formatDate(date)}</div>
              {selectedEncuentro?.time && (
                <div style={{ fontSize: 12, color: '#5f5e5a', marginTop: 3 }}>{selectedEncuentro.time} hrs</div>
              )}
            </div>
            {/* Botón editar */}
            <button
              onClick={onEdit}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: '#1a1a18', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar ficha
            </button>
          </div>
        </div>

        {/* ── Cuerpo — grid 2 columnas ── */}
        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Columna izquierda */}
            <div>
              <RoleCard title="Equipo Pastoral"  rows={sec('pastoral')}   colId={colId} />
              <RoleCard title="Producción"        rows={sec('produccion')} colId={colId} />
              <StreamingCard                      rows={sec('streaming')}  colId={colId} />
            </div>

            {/* Columna derecha */}
            <div>
              <EscenaCard   rows={sec('escena')}   colId={colId} />
              <SetListCard  rows={sec('setList')}  colId={colId} encuentro={selectedEncuentro} />
              <HorariosCard rows={sec('horarios')} colId={colId} />
            </div>

          </div>

          {/* Fila completa — Voluntarios + Anuncios */}
          <VoluntariosCard rows={sec('voluntarios')} colId={colId} />
          <AnunciosCard    rows={sec('anuncios')}    colId={colId} />
        </div>

      </div>
    </div>
  );
}

// Import React for useState
import React from 'react';
