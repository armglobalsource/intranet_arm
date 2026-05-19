'use client';

import React, { useState } from 'react';
import type { Ficha, Row, SectionName, Encuentro } from '@/types/ficha';

// ── Paleta ────────────────────────────────────────────────────────────────────

const C = {
  purple: '#7F77DD',
  green:  '#1D9E75',
  amber:  '#D4890A',
  gray:   '#6b6b6b',
} as const;

const SONG_DOT_COLORS = [C.purple, C.green, C.green, C.green, C.amber, C.gray];

// ── Dark theme tokens ─────────────────────────────────────────────────────────

const D = {
  bg:          '#111111',
  cardBg:      'rgba(255,255,255,0.04)',
  cardBorder:  'rgba(255,255,255,0.07)',
  divider:     'rgba(255,255,255,0.06)',
  headerBg:    'rgba(255,255,255,0.03)',
  badgeBg:     'rgba(255,255,255,0.07)',
  textPrimary: '#f0efec',
  textSecond:  '#888580',
  textMuted:   '#555350',
  inputBorder: 'rgba(255,255,255,0.18)',
} as const;

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

function val(row: Row, colId: string): string {
  if (row.shared) return (row.values?.['shared'] ?? row.values?.[colId] ?? '').trim();
  return (row.values?.[colId] ?? '').trim();
}

function rawVal(row: Row, colId: string): string {
  if (row.shared) return row.values?.['shared'] ?? row.values?.[colId] ?? '';
  return row.values?.[colId] ?? '';
}

function effectiveColId(row: Row, colId: string): string {
  return row.shared ? 'shared' : colId;
}

function rowsWithVal(rows: Row[], colId: string): Row[] {
  return [...rows].sort((a, b) => a.order - b.order).filter((r) => val(r, colId));
}

function allRows(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => a.order - b.order);
}

function timelineColor(label: string): { color: string; opacity: number } {
  const l = label.toLowerCase();
  if (/worship|vio|arw/.test(l))        return { color: C.purple, opacity: 0.9 };
  if (/predica/.test(l))                return { color: C.amber,  opacity: 0.9 };
  if (/inicio|opening|start/.test(l))   return { color: C.green,  opacity: 0.9 };
  return { color: '#444', opacity: 1 };
}

// ── Estilos base ──────────────────────────────────────────────────────────────

const S = {
  card: {
    background: D.cardBg,
    border: `0.5px solid ${D.cardBorder}`,
    borderRadius: 12,
    padding: '1rem 1.1rem',
    marginBottom: 14,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.12em', color: '#dbd7cf', marginBottom: 10,
  } as React.CSSProperties,
  roleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: `0.5px solid ${D.divider}`,
    gap: 8,
  } as React.CSSProperties,
  roleLabel: { fontSize: 12, color: D.textSecond, flexShrink: 0 } as React.CSSProperties,
  roleValue: {
    fontSize: 13, fontWeight: 500, color: D.textPrimary,
    textAlign: 'right' as const,
  } as React.CSSProperties,
};

// ── CellInput ─────────────────────────────────────────────────────────────────

function CellInput({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
      style={{
        border: 'none',
        borderBottom: `1px dashed ${D.inputBorder}`,
        outline: 'none',
        background: 'transparent',
        padding: '1px 2px',
        font: 'inherit',
        color: 'inherit',
        width: '100%',
        minWidth: 0,
        caretColor: C.purple,
        ...style,
      }}
    />
  );
}

// ── DeleteBtn ─────────────────────────────────────────────────────────────────

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Eliminar fila"
      style={{
        flexShrink: 0, fontSize: 11, lineHeight: 1, color: 'rgba(255,255,255,0.15)',
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.15)'; }}
    >
      ✕
    </button>
  );
}

// ── AddRowInline ──────────────────────────────────────────────────────────────

function AddRowInline({ sectionName, onAdd }: {
  sectionName: string;
  onAdd: (label: string, type: Row['type'], shared: boolean) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [label, setLabel] = useState('');
  const defaultType: Row['type'] =
    sectionName === 'setList' ? 'song'
    : sectionName === 'horarios' || sectionName === 'anuncios' ? 'text'
    : 'person';
  const [type, setType] = useState<Row['type']>(defaultType);

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${D.cardBorder}`,
    borderRadius: 6, padding: '3px 8px', fontSize: 11,
    outline: 'none', color: D.textPrimary,
  };

  const submit = () => {
    if (!label.trim()) return;
    const shared = ['produccion', 'streaming', 'escena', 'anuncios', 'voluntarios'].includes(sectionName);
    onAdd(label.trim(), type, shared);
    setLabel('');
    setOpen(false);
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{
        marginTop: 8, fontSize: 11, color: D.textMuted, background: 'none', border: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0,
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.purple; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = D.textMuted; }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Agregar fila
    </button>
  );

  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { setOpen(false); setLabel(''); }
        }}
        placeholder="Nombre de la fila…"
        style={{ ...inputStyle, flex: 1, minWidth: 100 }}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as Row['type'])}
        style={{ ...inputStyle, padding: '3px 5px' }}
      >
        <option value="person">Persona</option>
        <option value="text">Texto</option>
        <option value="song">Canción</option>
      </select>
      <button onClick={submit} style={{
        background: C.purple, color: '#fff', border: 'none', borderRadius: 6,
        padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
      }}>
        Agregar
      </button>
      <button onClick={() => { setOpen(false); setLabel(''); }} style={{
        fontSize: 11, color: D.textSecond, background: 'none', border: 'none', cursor: 'pointer',
      }}>
        ✕
      </button>
    </div>
  );
}

// ── SectionFooter ─────────────────────────────────────────────────────────────

function SectionFooter({ sectionName, editable, isCompleted, onAddRow, onComplete }: {
  sectionName: string;
  editable?: boolean;
  isCompleted?: boolean;
  onAddRow?: (label: string, type: Row['type'], shared: boolean) => void;
  onComplete?: () => void;
}) {
  if (!editable) return null;
  return (
    <div style={{ marginTop: 10, borderTop: `0.5px solid ${D.divider}`, paddingTop: 8 }}>
      {onAddRow && <AddRowInline sectionName={sectionName} onAdd={onAddRow} />}
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        {isCompleted ? (
          <span style={{ fontSize: 10, fontWeight: 600, color: C.green }}>✓ Sección completada</span>
        ) : onComplete ? (
          <button onClick={onComplete} style={{
            fontSize: 10, fontWeight: 600, color: C.green,
            background: 'rgba(29,158,117,0.1)', border: `1px solid rgba(29,158,117,0.25)`,
            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
          }}>
            ✓ Marcar completada
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Interfaz de props de edición ──────────────────────────────────────────────

interface EditProps {
  editable?: boolean;
  colId: string;
  onCellChange?: (rowId: string, colId: string, value: string) => void;
  onDeleteRow?: (rowId: string) => void;
  onAddRow?: (label: string, type: Row['type'], shared: boolean) => void;
  isCompleted?: boolean;
  onComplete?: () => void;
}

// ── RoleCard ──────────────────────────────────────────────────────────────────

function RoleCard({
  title, rows, colId,
  editable, onCellChange, onDeleteRow, onAddRow, isCompleted, onComplete,
}: { title: string; rows: Row[] } & EditProps) {
  const displayed = editable ? allRows(rows) : rowsWithVal(rows, colId);
  if (!editable && !displayed.length) return null;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      {displayed.map((row, i) => (
        <div key={row.id} style={{
          ...S.roleRow,
          ...(i === displayed.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}),
        }}>
          <span style={S.roleLabel}>{row.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
            {editable ? (
              <CellInput
                value={rawVal(row, colId)}
                onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
              />
            ) : (
              <span style={S.roleValue}>{val(row, colId)}</span>
            )}
            {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
          </div>
        </div>
      ))}
      <SectionFooter sectionName={title} editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── StreamingCard ─────────────────────────────────────────────────────────────

function StreamingCard({
  rows, colId,
  editable, onCellChange, onDeleteRow, onAddRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = editable ? allRows(rows) : rowsWithVal(rows, colId);
  const director  = displayed.filter((r) => /director|wirecast/i.test(r.label));
  const cameras   = displayed.filter((r) => /^cam\s?\d/i.test(r.label));
  const others    = displayed.filter((r) => !director.includes(r) && !cameras.includes(r));

  if (!editable && !displayed.length) return null;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Streaming</div>
      {[...director, ...others].map((row, i, arr) => (
        <div key={row.id} style={{
          ...S.roleRow,
          ...(!cameras.length && i === arr.length - 1 ? { borderBottom: 'none' } : {}),
        }}>
          <span style={S.roleLabel}>{row.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
            {editable ? (
              <CellInput
                value={rawVal(row, colId)}
                onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
              />
            ) : (
              <span style={S.roleValue}>{val(row, colId)}</span>
            )}
            {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
          </div>
        </div>
      ))}
      {cameras.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
          {cameras.map((row) => (
            <div key={row.id} style={{ background: D.badgeBg, borderRadius: 8, padding: '8px 10px', border: `0.5px solid ${D.cardBorder}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {row.label}
                </div>
                {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
              </div>
              {editable ? (
                <CellInput
                  value={rawVal(row, colId)}
                  onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                  style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary, marginTop: 2 }}
                />
              ) : (
                <div style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary, marginTop: 2 }}>
                  {val(row, colId)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <SectionFooter sectionName="streaming" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── EscenaCard ────────────────────────────────────────────────────────────────

function EscenaCard({
  rows, colId,
  editable, onCellChange, onDeleteRow, onAddRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed  = editable ? allRows(rows) : rowsWithVal(rows, colId);
  const vio        = displayed.find((r) => r.label === 'VIO');
  const positions  = displayed.filter((r) => /posición|posicion/i.test(r.label));
  const musicians  = displayed.filter((r) => r !== vio && !positions.includes(r));

  if (!editable && !displayed.length) return null;

  const half = Math.ceil(musicians.length / 2);
  const col1 = musicians.slice(0, half);
  const col2 = musicians.slice(half);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        AR Worship / Banda{(!editable && vio) ? ` — VIO: ${val(vio, colId)}` : ''}
      </div>

      {editable && vio && (
        <div style={{ ...S.roleRow, marginBottom: 8 }}>
          <span style={S.roleLabel}>VIO</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
            <CellInput
              value={rawVal(vio, colId)}
              onChange={(v) => onCellChange?.(vio.id, effectiveColId(vio, colId), v)}
              style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
            />
            {onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(vio.id)} />}
          </div>
        </div>
      )}

      {positions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {positions.map((row) => {
            const posLabel = row.label.replace(/posición\s*/i, '');
            return (
              <div key={row.id} style={{
                flex: 1, textAlign: 'center',
                background: D.badgeBg, borderRadius: 8, padding: '9px 4px',
                border: `0.5px solid ${D.cardBorder}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
                  <div style={{ flex: 1, fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>
                    {posLabel}
                  </div>
                  {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                </div>
                {editable ? (
                  <CellInput
                    value={rawVal(row, colId)}
                    onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                    style={{ fontSize: 12, fontWeight: 600, color: D.textPrimary, textAlign: 'center', marginTop: 2 }}
                  />
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: D.textPrimary, marginTop: 3 }}>
                    {val(row, colId)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {musicians.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          {[col1, col2].map((col, ci) => (
            <div key={ci}>
              {col.map((row, i) => (
                <div key={row.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 0', gap: 4,
                  borderBottom: i === col.length - 1 ? 'none' : `0.5px solid ${D.divider}`,
                }}>
                  <span style={{ fontSize: 11, color: D.textSecond, flexShrink: 0 }}>{row.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                    {editable ? (
                      <CellInput
                        value={rawVal(row, colId)}
                        onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                        style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary, textAlign: 'right' }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary }}>{val(row, colId)}</span>
                    )}
                    {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <SectionFooter sectionName="escena" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── SetListCard ───────────────────────────────────────────────────────────────

function SetListCard({
  rows, colId, encuentro,
  editable, onCellChange, onDeleteRow, onAddRow, isCompleted, onComplete,
}: { rows: Row[]; encuentro: Encuentro | null } & EditProps) {
  const displayed = editable ? allRows(rows) : rowsWithVal(rows, colId);
  if (!editable && !displayed.length) return null;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Set List</div>
      {displayed.map((row, i) => (
        <div key={row.id} style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '7px 0',
          borderBottom: i === displayed.length - 1 ? 'none' : `0.5px solid ${D.divider}`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: SONG_DOT_COLORS[i % SONG_DOT_COLORS.length],
            opacity: 0.85,
          }} />
          {editable ? (
            <>
              <CellInput
                value={rawVal(row, colId)}
                onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                placeholder="Nombre de la canción…"
                style={{ fontSize: 13, fontWeight: 500, color: D.textPrimary, flex: 1 }}
              />
              {onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 500, color: D.textPrimary, flex: 1 }}>
              {val(row, colId)}
            </span>
          )}
        </div>
      ))}
      <SectionFooter sectionName="setList" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── HorariosCard ──────────────────────────────────────────────────────────────

function HorariosCard({
  rows, colId,
  editable, onCellChange, onDeleteRow, onAddRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = editable ? allRows(rows) : rowsWithVal(rows, colId);
  if (!editable && !displayed.length) return null;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Horarios</div>
      {displayed.map((row) => {
        const { color, opacity } = timelineColor(row.label);
        const isBold = /worship|vio|predicación|inicio/i.test(row.label);
        return (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
            {editable ? (
              <CellInput
                value={rawVal(row, colId)}
                onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                placeholder="Hora…"
                style={{
                  fontSize: 11, width: 48, textAlign: 'right', flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: isBold ? 600 : 400,
                  color: isBold ? D.textPrimary : D.textSecond,
                }}
              />
            ) : (
              <span style={{
                fontSize: 11, width: 38, textAlign: 'right', flexShrink: 0,
                fontVariantNumeric: 'tabular-nums', fontWeight: isBold ? 600 : 400,
                color: isBold ? D.textPrimary : D.textSecond,
              }}>
                {val(row, colId)}
              </span>
            )}
            <div style={{ width: 3, height: 14, flexShrink: 0, borderRadius: 2, background: color, opacity }} />
            <span style={{ fontSize: 12, color: D.textPrimary, flex: 1, fontWeight: isBold ? 600 : 400 }}>
              {row.label}
            </span>
            {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
          </div>
        );
      })}
      <SectionFooter sectionName="horarios" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── AnunciosCard ──────────────────────────────────────────────────────────────

function AnunciosCard({
  rows, colId,
  editable, onCellChange, onDeleteRow, onAddRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = editable ? allRows(rows) : rowsWithVal(rows, colId);
  if (!editable && !displayed.length) return null;

  return (
    <div style={{ ...S.card, marginBottom: 0 }}>
      <div style={S.cardTitle}>Info Encuentro</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
        {displayed.map((row, i) => (
          <div key={row.id} style={{
            padding: '5px 0',
            borderBottom: i < displayed.length - 1 ? `0.5px solid ${D.divider}` : 'none',
          }}>
            <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <strong style={{ color: D.textSecond, fontWeight: 600, flexShrink: 0 }}>{row.label}:</strong>
              {editable ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
                  <CellInput
                    value={rawVal(row, colId)}
                    onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                    style={{ fontSize: 12, color: D.textPrimary, flex: 1 }}
                  />
                  {onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                </div>
              ) : (
                <span style={{ color: D.textPrimary }}>{val(row, colId)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <SectionFooter sectionName="anuncios" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── VoluntariosCard ───────────────────────────────────────────────────────────

function VoluntariosCard({
  rows, colId,
  editable, onCellChange, onDeleteRow, onAddRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = editable ? allRows(rows) : rowsWithVal(rows, colId);
  if (!editable && !displayed.length) return null;

  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.cardTitle}>Voluntarios de Servicio</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
        {displayed.map((row, i) => (
          <div key={row.id} style={{
            ...S.roleRow,
            ...(i >= displayed.length - 2 ? { borderBottom: 'none' } : {}),
          }}>
            <span style={S.roleLabel}>{row.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
              {editable ? (
                <CellInput
                  value={rawVal(row, colId)}
                  onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                  style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                />
              ) : (
                <span style={S.roleValue}>{val(row, colId)}</span>
              )}
              {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
            </div>
          </div>
        ))}
      </div>
      <SectionFooter sectionName="voluntarios" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
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
            border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
            ...(selected === e.id
              ? { background: e.color ?? C.purple, color: '#fff', borderColor: e.color ?? C.purple }
              : { background: 'rgba(255,255,255,0.05)', color: D.textSecond, borderColor: D.cardBorder }),
          }}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}

// ── FichaDocumentView — componente principal ──────────────────────────────────

export interface FichaDocumentViewProps {
  ficha:  Ficha;
  onEdit?: () => void;
  onSave?: () => void;
  editable?: boolean;
  localSections?: Partial<Record<SectionName, Row[]>>;
  onCellChange?: (section: SectionName, rowId: string, colId: string, value: string) => void;
  onAddRow?: (section: SectionName, label: string, type: Row['type'], shared: boolean) => void;
  onDeleteRow?: (section: SectionName, rowId: string) => void;
  onSectionComplete?: (section: SectionName) => void;
  sectionStatus?: Partial<Record<SectionName, boolean>>;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
}

export function FichaDocumentView({
  ficha, onEdit, onSave,
  editable, localSections, onCellChange, onAddRow, onDeleteRow, onSectionComplete,
  sectionStatus, saveState,
}: FichaDocumentViewProps) {
  const { sections, encuentros, campusName, title, date } = ficha;

  const [selectedId, setSelectedId] = useState<string>(
    encuentros?.[0]?.id ?? 'unico',
  );

  const selectedEncuentro = encuentros?.find((e) => e.id === selectedId) ?? null;
  const colId = selectedId;

  const sec = (name: SectionName): Row[] =>
    (editable && localSections ? localSections[name] : null)
    ?? sections?.[name]?.rows ?? [];

  const editProps = (name: SectionName): EditProps => ({
    editable,
    colId,
    onCellChange: onCellChange ? (rowId, cId, value) => onCellChange(name, rowId, cId, value) : undefined,
    onDeleteRow:  onDeleteRow  ? (rowId) => onDeleteRow(name, rowId)                           : undefined,
    onAddRow:     onAddRow     ? (label, type, shared) => onAddRow(name, label, type, shared)  : undefined,
    isCompleted:  sectionStatus?.[name] ?? sections?.[name]?.isCompleted,
    onComplete:   onSectionComplete ? () => onSectionComplete(name) : undefined,
  });

  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}/ficha/${ficha.fichaId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isSaving = saveState === 'saving';
  const isSaved  = saveState === 'saved';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <EncuentroTabs encuentros={encuentros ?? []} selected={selectedId} onChange={setSelectedId} />

      {/* Documento */}
      <div style={{
        background: D.bg,
        borderRadius: 16,
        border: `0.5px solid ${D.cardBorder}`,
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: D.headerBg,
          borderBottom: `0.5px solid ${D.cardBorder}`,
        }}>
          {/* Fila 1: logo (izq) + fecha (der) */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1.5rem 2rem 1rem',
            borderBottom: `0.5px solid ${D.divider}`,
          }}>
            <img
              src="/logo2.png"
              alt="ARM Global"
              style={{ height: 56, width: 'auto', objectFit: 'contain', display: 'block', maxWidth: '40%' }}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: D.textPrimary }}>{formatDate(date)}</div>
              {selectedEncuentro?.time && (
                <div style={{ fontSize: 12, color: D.textSecond, marginTop: 3 }}>{selectedEncuentro.time} hrs</div>
              )}
            </div>
          </div>

          {/* Fila 2: campus + título (izq) + botones (der) */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1rem 2rem 1.2rem', gap: 16,
          }}>
            {/* Campus + título */}
            <div>
              <div style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 4 }}>
                Campus {campusName}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: D.textPrimary, letterSpacing: '-0.01em' }}>
                {title}
              </div>
            </div>

            {/* ── Botones de acción ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

              {/* Guardar (solo modo edición) */}
              {editable && onSave && (
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: isSaving ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    background: isSaved ? C.green : 'rgba(255,255,255,0.1)',
                    color: D.textPrimary,
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  {isSaving ? (
                    <>
                      <svg style={{ animation: 'spin 1s linear infinite' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Guardando…
                    </>
                  ) : isSaved ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Guardado
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                      Guardar
                    </>
                  )}
                </button>
              )}

              {/* Editar (solo modo vista) */}
              {!editable && onEdit && (
                <button
                  onClick={onEdit}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'rgba(255,255,255,0.08)', color: D.textPrimary,
                    border: `0.5px solid ${D.cardBorder}`, cursor: 'pointer',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Editar
                </button>
              )}

              {/* Imprimir */}
              <button
                onClick={() => window.print()}
                title="Imprimir / PDF"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', color: D.textSecond,
                  border: `0.5px solid ${D.cardBorder}`, cursor: 'pointer',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Imprimir
              </button>

              {/* Compartir */}
              <button
                onClick={handleShare}
                title="Copiar link público"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: copied ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.06)',
                  color: copied ? C.green : D.textSecond,
                  border: `0.5px solid ${copied ? 'rgba(29,158,117,0.3)' : D.cardBorder}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {copied ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Compartir
                  </>
                )}
              </button>

            </div>{/* fin botones */}
          </div>{/* fin fila 2 */}
        </div>{/* fin header */}

        {/* ── Cuerpo ── */}
        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <RoleCard title="Equipo Pastoral" rows={sec('pastoral')}   {...editProps('pastoral')} />
              <RoleCard title="Producción"       rows={sec('produccion')} {...editProps('produccion')} />
              <StreamingCard                     rows={sec('streaming')}  {...editProps('streaming')} />
            </div>
            <div>
              <EscenaCard   rows={sec('escena')}   {...editProps('escena')} />
              <SetListCard  rows={sec('setList')}  {...editProps('setList')} encuentro={selectedEncuentro} />
              <HorariosCard rows={sec('horarios')} {...editProps('horarios')} />
            </div>
          </div>

          <VoluntariosCard rows={sec('voluntarios')} {...editProps('voluntarios')} />
          <AnunciosCard    rows={sec('anuncios')}    {...editProps('anuncios')} />
        </div>

      </div>
    </div>
  );
}
