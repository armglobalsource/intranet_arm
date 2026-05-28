'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Ficha, Row, SectionName, Encuentro } from '@/types/ficha';
import { SECTION_LABELS } from '@/types/ficha';
import { useUpdateFicha } from '@/hooks/useFichas';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

function parseLocalDate(raw: any): Date {
  if (typeof raw?.toDate === 'function') return raw.toDate();
  if (raw instanceof Date)               return raw;
  if (raw?.seconds)                      return new Date(raw.seconds * 1000);
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0); // mediodía local evita desfases UTC
  }
  return new Date(raw);
}

function formatDate(raw: any): string {
  if (!raw) return '—';
  return parseLocalDate(raw).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, (c) => c.toUpperCase());
}

function formatDateTime(raw: any): string {
  if (!raw) return '—';
  const d = parseLocalDate(raw);
  const date = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
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
      className="ficha-cell-input"
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
      className="ficha-no-print"
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

// ── Drag & Drop ───────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2"   r="1.3" />
      <circle cx="6.5" cy="2"   r="1.3" />
      <circle cx="2.5" cy="6.5" r="1.3" />
      <circle cx="6.5" cy="6.5" r="1.3" />
      <circle cx="2.5" cy="11"  r="1.3" />
      <circle cx="6.5" cy="11"  r="1.3" />
    </svg>
  );
}

/** Wrapper DnD para una lista sortable. Cuando `onReorder` es undefined, renderiza sin contexto DnD. */
function SortableSection({
  items,
  onReorder,
  children,
}: {
  items: { id: string }[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const fromIndex = items.findIndex((r) => r.id === String(active.id));
    const toIndex   = items.findIndex((r) => r.id === String(over.id));
    if (fromIndex !== -1 && toIndex !== -1) onReorder(fromIndex, toIndex);
  }

  if (!onReorder) return <>{children}</>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Wrapper para una fila individual sortable.
 * `children` es un render-prop que recibe el elemento handle para insertarlo donde corresponda.
 */
function SortableRow({
  id,
  editable,
  children,
}: {
  id: string;
  editable?: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editable,
  });

  const handle = editable ? (
    <button
      {...attributes}
      {...listeners}
      className="ficha-no-print"
      title="Arrastrar para reordenar"
      style={{
        flexShrink: 0,
        cursor: isDragging ? 'grabbing' : 'grab',
        color: 'rgba(255,255,255,0.18)',
        background: 'none',
        border: 'none',
        padding: '0 5px 0 0',
        display: 'flex',
        alignItems: 'center',
        touchAction: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)'; }}
    >
      <GripIcon />
    </button>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {children(handle)}
    </div>
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
    <div className="ficha-no-print" style={{ marginTop: 10, borderTop: `0.5px solid ${D.divider}`, paddingTop: 8 }}>
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
  forceShowAll?: boolean;   // Siempre mostrar la card aunque las filas estén vacías
  colId: string;
  onCellChange?: (rowId: string, colId: string, value: string) => void;
  onDeleteRow?: (rowId: string) => void;
  onAddRow?: (label: string, type: Row['type'], shared: boolean) => void;
  /** Reordena filas: fromIndex y toIndex son posiciones en el array ordenado (allRows) */
  onReorderRow?: (fromIndex: number, toIndex: number) => void;
  isCompleted?: boolean;
  onComplete?: () => void;
}

// ── RoleCard ──────────────────────────────────────────────────────────────────

function RoleCard({
  title, rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
}: { title: string; rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        {displayed.map((row, i) => (
          <SortableRow key={row.id} id={row.id} editable={editable}>
            {(handle) => (
              <div style={{
                ...S.roleRow,
                ...(i === displayed.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}),
              }}>
                {handle}
                <span style={S.roleLabel}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                  {editable ? (
                    <CellInput
                      value={rawVal(row, colId)}
                      onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                      style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                    />
                  ) : (
                    <span style={{ ...S.roleValue, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                  )}
                  {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                </div>
              </div>
            )}
          </SortableRow>
        ))}
      </SortableSection>
      <SectionFooter sectionName={title} editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── StreamingCard ─────────────────────────────────────────────────────────────

function StreamingCard({
  rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  const director  = displayed.filter((r) => /director|wirecast/i.test(r.label));
  const cameras   = displayed.filter((r) => /^cam\s?\d/i.test(r.label));
  const others    = displayed.filter((r) => !director.includes(r) && !cameras.includes(r));
  const roleRows  = [...director, ...others];

  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={S.card}>
      <div style={S.cardTitle}>Streaming</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        {roleRows.map((row, i) => (
          <SortableRow key={row.id} id={row.id} editable={editable}>
            {(handle) => (
              <div style={{
                ...S.roleRow,
                ...(!cameras.length && i === roleRows.length - 1 ? { borderBottom: 'none' } : {}),
              }}>
                {handle}
                <span style={S.roleLabel}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                  {editable ? (
                    <CellInput
                      value={rawVal(row, colId)}
                      onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                      style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                    />
                  ) : (
                    <span style={{ ...S.roleValue, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                  )}
                  {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                </div>
              </div>
            )}
          </SortableRow>
        ))}
        {cameras.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
            {cameras.map((row) => (
              <SortableRow key={row.id} id={row.id} editable={editable}>
                {(handle) => (
                  <div style={{ background: D.badgeBg, borderRadius: 8, padding: '8px 10px', border: `0.5px solid ${D.cardBorder}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {handle}
                        <div style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          {row.label}
                        </div>
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
                      <div style={{ fontSize: 12, fontWeight: 500, color: val(row, colId) ? D.textPrimary : D.textMuted, marginTop: 2 }}>
                        {val(row, colId) || '—'}
                      </div>
                    )}
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        )}
      </SortableSection>
      <SectionFooter sectionName="streaming" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── EscenaCard ────────────────────────────────────────────────────────────────

function EscenaCard({
  rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed  = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  const vio        = displayed.find((r) => r.label === 'VIO');
  const positions  = displayed.filter((r) => /posición|posicion/i.test(r.label));
  const musicians  = displayed.filter((r) => r !== vio && !positions.includes(r));

  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={S.card}>
      <div style={S.cardTitle}>
        AR Worship / Banda{(!editable && vio) ? ` — VIO: ${val(vio, colId)}` : ''}
      </div>

      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        {editable && vio && (
          <SortableRow id={vio.id} editable={editable}>
            {(handle) => (
              <div style={{ ...S.roleRow, marginBottom: 8 }}>
                {handle}
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
          </SortableRow>
        )}

        {positions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {positions.map((row) => {
              const posLabel = row.label.replace(/posición\s*/i, '');
              return (
                <SortableRow key={row.id} id={row.id} editable={editable}>
                  {(handle) => (
                    <div style={{
                      flex: 1, textAlign: 'center',
                      background: D.badgeBg, borderRadius: 8, padding: '9px 4px',
                      border: `0.5px solid ${D.cardBorder}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
                          {handle}
                          <div style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {posLabel}
                          </div>
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
                  )}
                </SortableRow>
              );
            })}
          </div>
        )}

        {musicians.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {musicians.map((row) => (
              <SortableRow key={row.id} id={row.id} editable={editable}>
                {(handle) => (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 0', gap: 4,
                    borderBottom: `0.5px solid ${D.divider}`,
                  }}>
                    {handle}
                    <span style={{ fontSize: 11, color: D.textSecond, flexShrink: 0 }}>{row.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                      {editable ? (
                        <CellInput
                          value={rawVal(row, colId)}
                          onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                          style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary, textAlign: 'right' }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 500, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                      )}
                      {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                    </div>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        )}
      </SortableSection>

      <SectionFooter sectionName="escena" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── SetListCard ───────────────────────────────────────────────────────────────

function SetListCard({
  rows, colId, encuentro,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
}: { rows: Row[]; encuentro: Encuentro | null } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={S.card}>
      <div style={S.cardTitle}>Set List</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        {displayed.map((row, i) => (
          <SortableRow key={row.id} id={row.id} editable={editable}>
            {(handle) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 0',
                borderBottom: i === displayed.length - 1 ? 'none' : `0.5px solid ${D.divider}`,
              }}>
                {handle}
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
                  <span style={{ fontSize: 13, fontWeight: 500, color: val(row, colId) ? D.textPrimary : D.textMuted, flex: 1 }}>
                    {val(row, colId) || '—'}
                  </span>
                )}
              </div>
            )}
          </SortableRow>
        ))}
      </SortableSection>
      <SectionFooter sectionName="setList" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── HorariosCard ──────────────────────────────────────────────────────────────

function HorariosCard({
  rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={S.card}>
      <div style={S.cardTitle}>Horarios</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        {displayed.map((row) => {
          const { color, opacity } = timelineColor(row.label);
          const isBold = /worship|vio|predicación|inicio/i.test(row.label);
          return (
            <SortableRow key={row.id} id={row.id} editable={editable}>
              {(handle) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  {handle}
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
                      color: val(row, colId) ? (isBold ? D.textPrimary : D.textSecond) : D.textMuted,
                    }}>
                      {val(row, colId) || '—'}
                    </span>
                  )}
                  <div style={{ width: 3, height: 14, flexShrink: 0, borderRadius: 2, background: color, opacity }} />
                  <span style={{ fontSize: 12, color: D.textPrimary, flex: 1, fontWeight: isBold ? 600 : 400 }}>
                    {row.label}
                  </span>
                  {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                </div>
              )}
            </SortableRow>
          );
        })}
      </SortableSection>
      <SectionFooter sectionName="horarios" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── AnunciosCard ──────────────────────────────────────────────────────────────

function AnunciosCard({
  rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={{ ...S.card, marginBottom: 0 }}>
      <div style={S.cardTitle}>Info Encuentro</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
          {displayed.map((row, i) => (
            <SortableRow key={row.id} id={row.id} editable={editable}>
              {(handle) => (
                <div style={{
                  padding: '5px 0',
                  borderBottom: i < displayed.length - 1 ? `0.5px solid ${D.divider}` : 'none',
                }}>
                  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    {handle}
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
                      <span style={{ color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                    )}
                  </div>
                </div>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableSection>
      <SectionFooter sectionName="anuncios" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── VoluntariosCard ───────────────────────────────────────────────────────────

function VoluntariosCard({
  rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.cardTitle}>Voluntarios de Servicio</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
          {displayed.map((row, i) => (
            <SortableRow key={row.id} id={row.id} editable={editable}>
              {(handle) => (
                <div style={{
                  ...S.roleRow,
                  ...(i >= displayed.length - 2 ? { borderBottom: 'none' } : {}),
                }}>
                  {handle}
                  <span style={S.roleLabel}>{row.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                    {editable ? (
                      <CellInput
                        value={rawVal(row, colId)}
                        onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                        style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                      />
                    ) : (
                      <span style={{ ...S.roleValue, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                    )}
                    {editable && onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                  </div>
                </div>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableSection>
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
    <div className="ficha-no-print" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
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
  onArchive?: () => void;
  onUnarchive?: () => void;
  canArchive?: boolean;
  onPublish?: () => void;
  onUnpublish?: () => void;
  canPublish?: boolean;
  isPublishing?: boolean;
  editable?: boolean;
  /** Cuando true, muestra todos los módulos habilitados aunque sus filas estén vacías (contexto editor) */
  forceShowAll?: boolean;
  localSections?: Partial<Record<SectionName, Row[]>>;
  onCellChange?: (section: SectionName, rowId: string, colId: string, value: string) => void;
  onAddRow?: (section: SectionName, label: string, type: Row['type'], shared: boolean) => void;
  onDeleteRow?: (section: SectionName, rowId: string) => void;
  onReorderRow?: (section: SectionName, fromIndex: number, toIndex: number) => void;
  onSectionComplete?: (section: SectionName) => void;
  sectionStatus?: Partial<Record<SectionName, boolean>>;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  hiddenSections?: SectionName[];
  onToggleModule?: (name: SectionName) => void;
}

export function FichaDocumentView({
  ficha, onEdit, onSave, onArchive, onUnarchive, canArchive,
  onPublish, onUnpublish, canPublish, isPublishing,
  editable, forceShowAll, localSections, onCellChange, onAddRow, onDeleteRow, onReorderRow, onSectionComplete,
  sectionStatus, saveState, hiddenSections, onToggleModule,
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
    forceShowAll,
    colId,
    onCellChange:  onCellChange  ? (rowId, cId, value) => onCellChange(name, rowId, cId, value)      : undefined,
    onDeleteRow:   onDeleteRow   ? (rowId) => onDeleteRow(name, rowId)                                : undefined,
    onAddRow:      onAddRow      ? (label, type, shared) => onAddRow(name, label, type, shared)       : undefined,
    onReorderRow:  onReorderRow  ? (from, to) => onReorderRow(name, from, to)                        : undefined,
    isCompleted:   sectionStatus?.[name] ?? sections?.[name]?.isCompleted,
    onComplete:    onSectionComplete ? () => onSectionComplete(name)                                  : undefined,
  });

  const [copied,           setCopied]           = useState(false);
  const [modulesOpen,      setModulesOpen]      = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const isPublished = ficha.published ?? false;
  const modulesRef = useRef<HTMLDivElement>(null);

  const hidden = (n: SectionName) => (hiddenSections ?? []).includes(n);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modulesRef.current && !modulesRef.current.contains(e.target as Node)) {
        setModulesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Edición inline del título ─────────────────────────────────────────────
  const { mutate: updateFicha } = useUpdateFicha();
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle,   setLocalTitle]   = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalTitle(title); }, [title]);
  useEffect(() => { if (editingTitle) titleInputRef.current?.select(); }, [editingTitle]);

  function commitTitle() {
    const trimmed = localTitle.trim();
    if (!trimmed || trimmed === title) { setLocalTitle(title); setEditingTitle(false); return; }
    updateFicha({ fichaId: String(ficha.fichaId), title: trimmed });
    setEditingTitle(false);
  }

  // ── Edición inline de la fecha ────────────────────────────────────────────
  // date puede ser ISO string "2026-05-24" o timestamp; normalizar a "YYYY-MM-DD"
  function toInputDate(raw: any): string {
    if (!raw) return '';
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = parseLocalDate(raw);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const [editingDate, setEditingDate] = useState(false);
  const [localDate,   setLocalDate]   = useState(() => toInputDate(date));
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalDate(toInputDate(date)); }, [date]);
  useEffect(() => {
    if (editingDate) requestAnimationFrame(() => {
      dateInputRef.current?.focus();
      dateInputRef.current?.showPicker?.();
    });
  }, [editingDate]);

  function commitDate() {
    if (!localDate || localDate === toInputDate(date)) { setEditingDate(false); return; }
    const [y, mo, d] = localDate.split('-').map(Number);
    const localNoon = new Date(y, mo - 1, d, 12, 0, 0).toISOString();
    updateFicha({ fichaId: String(ficha.fichaId), date: localNoon });
    setEditingDate(false);
  }

  function handleShare() {
    const url = `${window.location.origin}/ficha/${String(ficha.fichaId)}`;

    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    };

    // Intento 1: Clipboard API moderna
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(markCopied).catch(() => fallbackCopy(url, markCopied));
    } else {
      fallbackCopy(url, markCopied);
    }
  }

  function fallbackCopy(url: string, onSuccess: () => void) {
    // Intento 2: execCommand (compatible con más navegadores)
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { onSuccess(); return; }
    } catch {}
    // Último recurso: mostrar URL en un prompt
    window.prompt('Copia este link:', url);
  }

  const isSaving = saveState === 'saving';
  const isSaved  = saveState === 'saved';

  return (
    <div
      className="ficha-doc-root"
      style={{ maxWidth: 900, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* ── Estilos globales y de impresión ── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }

        @media print {
          /* Colores exactos */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            line-height: 1.3 !important;
          }

          /* Ocultar controles */
          .ficha-no-print { display: none !important; }

          /* Contenedor raíz */
          .ficha-doc-root { max-width: 100% !important; margin: 0 !important; }

          /* Documento → fondo blanco, sin borde redondeado */
          .ficha-doc {
            background: #ffffff !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          /* Textos → oscuros */
          .ficha-doc, .ficha-doc div, .ficha-doc span,
          .ficha-doc p, .ficha-doc strong, .ficha-doc input {
            color: #111 !important;
          }

          /* Header compacto */
          .ficha-hdr {
            background: #f2f2f2 !important;
            border-bottom: 1px solid #ddd !important;
          }
          .ficha-hdr-top {
            padding: 6px 12px !important;
            border-bottom: 1px solid #e8e8e8 !important;
          }
          .ficha-hdr-top img { height: 22px !important; }
          .ficha-hdr-top div[style] { font-size: 9px !important; }

          /* Fila campus + título */
          .ficha-hdr > div:last-child {
            padding: 5px 12px 6px !important;
          }

          /* Logo blanco → negro */
          .ficha-logo { filter: brightness(0) !important; }

          /* Cuerpo muy compacto */
          .ficha-body { padding: 6px 8px !important; }

          /* Grilla: gap mínimo */
          .ficha-grid { gap: 5px !important; }

          /* Tarjetas: sin fondo, borde fino, padding mínimo, no cortar */
          .ficha-card {
            background: #ffffff !important;
            border: 0.5px solid #ccc !important;
            border-radius: 4px !important;
            padding: 5px 7px !important;
            margin-bottom: 5px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Título de sección más pequeño */
          .ficha-card > div:first-child {
            font-size: 7px !important;
            margin-bottom: 4px !important;
          }

          /* Filas de roles: menos padding */
          .ficha-card div[style*="padding: 6px"] {
            padding: 2px 0 !important;
          }

          /* Fuentes globales reducidas */
          .ficha-doc { font-size: 9px !important; }

          /* Inputs: línea tenue */
          .ficha-cell-input {
            border-bottom: 0.5px solid #aaa !important;
            background: transparent !important;
          }
        }
      `}</style>

      <EncuentroTabs encuentros={encuentros ?? []} selected={selectedId} onChange={setSelectedId} />

      {/* Banner ficha archivada */}
      {ficha.archived && (
        <div className="ficha-no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 16px', marginBottom: 8,
          background: 'rgba(251,191,36,0.08)',
          border: '0.5px solid rgba(251,191,36,0.25)',
          borderRadius: 12, fontSize: 12, color: '#F59E0B', fontWeight: 600,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          Esta ficha está archivada
        </div>
      )}

      {/* Documento */}
      <div
        className="ficha-doc"
        style={{
          background: D.bg,
          borderRadius: 16,
          border: `0.5px solid ${D.cardBorder}`,
          overflow: 'hidden',
        }}
      >

        {/* ── Header ── */}
        <div
          className="ficha-hdr"
          style={{
            background: D.headerBg,
            borderBottom: `0.5px solid ${D.cardBorder}`,
          }}
        >
          {/* Fila 1: logo (izq) + fecha (der) */}
          <div
            className="ficha-hdr-top"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1.5rem 2rem 1rem',
              borderBottom: `0.5px solid ${D.divider}`,
            }}
          >
            <img
              src="/logo2.png"
              alt="ARM Global"
              className="ficha-logo"
              style={{ height: 40, width: 'auto', objectFit: 'contain', display: 'block', maxWidth: '40%' }}
            />
            <div style={{ textAlign: 'right' }}>
              {editable && editingDate ? (
                <input
                  ref={dateInputRef}
                  type="date"
                  value={localDate}
                  onChange={(e) => setLocalDate(e.target.value)}
                  onBlur={commitDate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); commitDate(); }
                    if (e.key === 'Escape') { setLocalDate(toInputDate(date)); setEditingDate(false); }
                  }}
                  style={{
                    fontSize: 14, fontWeight: 600, color: D.textPrimary,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6, padding: '2px 8px', outline: 'none',
                    colorScheme: 'dark',
                  }}
                />
              ) : (
                <div
                  onClick={() => editable && setEditingDate(true)}
                  title={editable ? 'Clic para editar fecha' : undefined}
                  style={{
                    fontSize: 15, fontWeight: 600, color: D.textPrimary,
                    cursor: editable ? 'text' : 'default',
                    borderRadius: 6, padding: '2px 6px',
                    border: editable ? '1px solid transparent' : 'none',
                    transition: 'border-color 0.15s, background 0.15s',
                    display: 'inline-block',
                  }}
                  onMouseEnter={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                >
                  {formatDate(localDate || date)}
                </div>
              )}
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 4 }}>
                {/^(campus|arm)\s/i.test(campusName ?? '') ? campusName : `Campus ${campusName}`}
              </div>

              {editable && editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); commitTitle(); }
                    if (e.key === 'Escape') { setLocalTitle(title); setEditingTitle(false); }
                  }}
                  style={{
                    fontSize: 22, fontWeight: 700, color: D.textPrimary, letterSpacing: '-0.01em',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6, padding: '2px 8px', outline: 'none', width: '100%',
                  }}
                />
              ) : (
                <div
                  onClick={() => editable && setEditingTitle(true)}
                  title={editable ? 'Clic para editar título' : undefined}
                  style={{
                    fontSize: 22, fontWeight: 700, color: D.textPrimary, letterSpacing: '-0.01em',
                    cursor: editable ? 'text' : 'default',
                    borderRadius: 6,
                    padding: '2px 4px',
                    marginLeft: -4,
                    border: editable ? '1px solid transparent' : 'none',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                >
                  {localTitle}
                </div>
              )}
            </div>

            {/* ── Botones de acción (ocultos en impresión) ── */}
            <div className="ficha-no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

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

              {/* Módulos (solo modo edición) */}
              {editable && onToggleModule && (
                <div ref={modulesRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setModulesOpen((o) => !o)}
                    title="Gestionar módulos"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: modulesOpen ? 'rgba(127,119,221,0.15)' : 'rgba(255,255,255,0.06)',
                      color: modulesOpen ? C.purple : D.textSecond,
                      border: `0.5px solid ${modulesOpen ? 'rgba(127,119,221,0.35)' : D.cardBorder}`,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                    </svg>
                    Módulos
                  </button>
                  {modulesOpen && (
                    <div
                      style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                        background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.12)',
                        borderRadius: 10, padding: '6px 0', minWidth: 220,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      }}
                    >
                      <p style={{ padding: '4px 12px 8px', fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>
                        Módulos activos
                      </p>
                      {(Object.keys(SECTION_LABELS) as SectionName[]).map((name) => {
                        const isHidden = hidden(name);
                        return (
                          <button
                            key={name}
                            onClick={() => onToggleModule(name)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              width: '100%', padding: '8px 12px', fontSize: 12,
                              color: isHidden ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              textAlign: 'left', transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <span style={{
                              flexShrink: 0, width: 16, height: 16, borderRadius: 4,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: isHidden ? 'rgba(255,255,255,0.06)' : 'rgba(29,158,117,0.2)',
                              border: `1px solid ${isHidden ? 'rgba(255,255,255,0.1)' : 'rgba(29,158,117,0.4)'}`,
                            }}>
                              {!isHidden && (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                                  stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                            {SECTION_LABELS[name]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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

              {/* Publicar / Despublicar */}
              {canPublish && (
                <button
                  onClick={() => setConfirmingPublish((v) => !v)}
                  title={isPublished ? 'Despublicar ficha' : 'Publicar ficha'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: isPublished
                      ? (confirmingPublish ? 'rgba(29,158,117,0.2)' : 'rgba(29,158,117,0.12)')
                      : (confirmingPublish ? 'rgba(239,68,68,0.2)'  : 'rgba(239,68,68,0.1)'),
                    color: isPublished ? C.green : '#F87171',
                    border: `0.5px solid ${isPublished ? 'rgba(29,158,117,0.35)' : 'rgba(239,68,68,0.35)'}`,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {isPublished ? 'Publicada' : 'Publicar'}
                </button>
              )}

              {/* Archivar / Desarchivar */}
              {canArchive && (
                ficha.archived ? (
                  <button
                    onClick={onUnarchive}
                    title="Desarchivar ficha"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'rgba(251,191,36,0.12)', color: '#F59E0B',
                      border: '0.5px solid rgba(251,191,36,0.25)', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-4.51" />
                    </svg>
                    Desarchivar
                  </button>
                ) : (
                  <button
                    onClick={onArchive}
                    title="Archivar ficha"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)', color: D.textSecond,
                      border: `0.5px solid ${D.cardBorder}`, cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="21 8 21 21 3 21 3 8" />
                      <rect x="1" y="3" width="22" height="5" />
                      <line x1="10" y1="12" x2="14" y2="12" />
                    </svg>
                    Archivar
                  </button>
                )
              )}

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

        {/* ── Banner confirmación publicar/despublicar ── */}
        {confirmingPublish && canPublish && (
          <div className="ficha-no-print" style={{
            margin: '0 1.5rem',
            padding: '10px 14px',
            borderRadius: 10,
            background: isPublished ? 'rgba(29,158,117,0.08)' : 'rgba(239,68,68,0.08)',
            border: `0.5px solid ${isPublished ? 'rgba(29,158,117,0.25)' : 'rgba(239,68,68,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <p style={{ fontSize: 12, color: isPublished ? '#34D399' : '#FCA5A5', margin: 0 }}>
              {isPublished
                ? '¿Despublicar esta ficha? Dejará de ser visible para los usuarios asignados.'
                : '¿Publicar esta ficha? Será visible para todos los asignados y compartible por link.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => { (isPublished ? onUnpublish : onPublish)?.(); setConfirmingPublish(false); }}
                disabled={isPublishing}
                style={{
                  padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  background: isPublished ? 'rgba(29,158,117,0.2)' : 'rgba(239,68,68,0.2)',
                  color: isPublished ? C.green : '#F87171',
                  border: `0.5px solid ${isPublished ? 'rgba(29,158,117,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  cursor: isPublishing ? 'default' : 'pointer',
                  opacity: isPublishing ? 0.6 : 1,
                }}
              >
                {isPublishing
                  ? (isPublished ? 'Despublicando…' : 'Publicando…')
                  : (isPublished ? 'Sí, despublicar' : 'Sí, publicar')}
              </button>
              <button
                onClick={() => setConfirmingPublish(false)}
                style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  background: 'rgba(255,255,255,0.06)', color: D.textSecond,
                  border: `0.5px solid ${D.cardBorder}`, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Cuerpo ── */}
        <div className="ficha-body" style={{ padding: '1.5rem 2rem' }}>
          <div className="ficha-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              {!hidden('pastoral')   && <RoleCard title="Equipo Pastoral" rows={sec('pastoral')}   {...editProps('pastoral')} />}
              {!hidden('produccion') && <RoleCard title="Producción"       rows={sec('produccion')} {...editProps('produccion')} />}
              {!hidden('streaming')  && <StreamingCard                     rows={sec('streaming')}  {...editProps('streaming')} />}
            </div>
            <div>
              {!hidden('escena')   && <EscenaCard   rows={sec('escena')}   {...editProps('escena')} />}
              {!hidden('setList')  && <SetListCard  rows={sec('setList')}  {...editProps('setList')} encuentro={selectedEncuentro} />}
              {!hidden('horarios') && <HorariosCard rows={sec('horarios')} {...editProps('horarios')} />}
            </div>
          </div>

          {!hidden('voluntarios') && <VoluntariosCard rows={sec('voluntarios')} {...editProps('voluntarios')} />}
          {!hidden('anuncios')    && <AnunciosCard    rows={sec('anuncios')}    {...editProps('anuncios')} />}
        </div>

        {/* ── Footer de auditoría ── */}
        <div
          className="ficha-no-print"
          style={{
            borderTop: `0.5px solid ${D.divider}`,
            padding: '8px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 20,
          }}
        >
          {ficha.createdAt && (
            <span style={{ fontSize: 10, color: D.textMuted }}>
              Creado por <span style={{ color: D.textSecond }}>{ficha.createdByName}</span>
              {' · '}{formatDateTime(ficha.createdAt)}
            </span>
          )}
          {ficha.lastModifiedAt && (
            <span style={{ fontSize: 10, color: D.textMuted }}>
              Última edición
              {ficha.lastModifiedByName ? <> por <span style={{ color: D.textSecond }}>{ficha.lastModifiedByName}</span></> : ''}
              {' · '}{formatDateTime(ficha.lastModifiedAt)}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
