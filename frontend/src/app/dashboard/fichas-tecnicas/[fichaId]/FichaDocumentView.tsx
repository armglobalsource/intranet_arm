'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Ficha, Row, SectionName, Encuentro } from '@/types/ficha';
import { SECTION_LABELS } from '@/types/ficha';
import { SongInput } from '@/components/fichas/SongInput';
import { useUsers } from '@/hooks/useUsers';
import { displayName } from '@/types/user';

// Secciones disponibles por tipo de ficha (para el panel de módulos)
const SECTIONS_BY_TYPE: Record<string, SectionName[]> = {
  unico:   ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit'],
  multi:   ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit'],
  oracion: ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'outfit'],
};
import { useUpdateFicha } from '@/hooks/useFichas';
import { parseFichaDate as parseLocalDate, toFichaInputDate } from '@/lib/ficha-date';
import { usePaletas, useCreatePaleta, type Paleta, type PaletaColor } from '@/hooks/usePaletas';
import {
  DndContext,
  closestCenter,
  closestCorners,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
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

// ── Datos enriquecidos de canción ─────────────────────────────────────────────

interface SongData {
  titulo:    string;
  tonalidad: string;
  cantante:  string;
  tipo?:     string;
  bpm?:      number;
}

function parseSongData(raw: string): SongData {
  if (!raw) return { titulo: '', tonalidad: '', cantante: '' };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && 'titulo' in p) {
      return { titulo: p.titulo || '', tonalidad: p.tonalidad || '', cantante: p.cantante || '', tipo: p.tipo, bpm: p.bpm };
    }
  } catch {}
  // Retrocompatibilidad: el valor era solo el título (texto plano)
  return { titulo: raw, tonalidad: '', cantante: '' };
}

function encodeSongData(data: SongData): string {
  if (!data.titulo && !data.tonalidad && !data.cantante) return '';
  return JSON.stringify({
    titulo:    data.titulo,
    tonalidad: data.tonalidad,
    cantante:  data.cantante,
    ...(data.tipo ? { tipo: data.tipo } : {}),
    ...(data.bpm  ? { bpm:  data.bpm  } : {}),
  });
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

// ── PersonCellInput ───────────────────────────────────────────────────────────
// Mismo contrato que CellInput (drop-in), pero con autocomplete: al escribir
// 3+ caracteres busca entre todas las personas registradas y permite
// seleccionarlas. Si la persona no está en el sistema, se puede seguir
// escribiendo el nombre a mano igual que antes — no obliga a elegir de la lista.

const PERSON_SEARCH_MIN_CHARS = 3;

function PersonCellInput({ value, onChange, placeholder, style, multiline, rows }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  rows?: number;
}) {
  const { data: users = [] } = useUsers();
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < PERSON_SEARCH_MIN_CHARS) return [];
    return users
      .filter((u) => displayName(u).toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, users]);

  const showDrop = open && suggestions.length > 0;

  const sharedProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { onChange(e.target.value); setOpen(true); },
    onFocus: () => setOpen(true),
    onBlur: () => setTimeout(() => setOpen(false), 150),
    placeholder: placeholder ?? '—',
    className: 'ficha-cell-input',
    style: {
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
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {multiline ? (
        <textarea rows={rows ?? 2} {...sharedProps} style={{ ...sharedProps.style, resize: 'none' }} />
      ) : (
        <input type="text" {...sharedProps} />
      )}
      {showDrop && (
        <div
          className="ficha-no-print"
          style={{
            position: 'absolute', zIndex: 50, left: 0, right: 0, top: '100%', marginTop: 3,
            background: '#1c1c1c', border: `1px solid ${D.cardBorder}`, borderRadius: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)', maxHeight: 180, overflowY: 'auto', textAlign: 'left',
          }}
        >
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={() => { onChange(displayName(u)); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: `1px solid ${D.divider}`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary }}>{displayName(u)}</div>
              {u.email && <div style={{ fontSize: 10, color: D.textMuted }}>{u.email}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
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

// ── EditableLabel ─────────────────────────────────────────────────────────────

/**
 * Label editable inline. Muestra el valor como texto y al hacer click (o
 * doble-click) se convierte en input. Guarda en blur o Enter. Escape
 * cancela.
 *
 * En modo NO editable renderiza como span estático (mismo texto, sin
 * caja de input). Útil para vista de solo lectura y para impresión.
 */
function EditableLabel({
  value,
  editable,
  onChange,
  style,
  placeholder = 'Nombre…',
}: {
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === value) { setDraft(value); return; }
    onChange?.(trimmed);
  }

  if (!editable || !onChange) {
    return <span style={style}>{value}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        placeholder={placeholder}
        style={{
          ...style,
          background: 'rgba(127,119,221,0.08)',
          border: '1px solid rgba(127,119,221,0.45)',
          borderRadius: 4,
          padding: '1px 4px',
          outline: 'none',
          color: D.textPrimary,
          font: 'inherit',
          minWidth: 60,
          caretColor: C.purple,
        }}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); } }}
      title="Click para renombrar"
      className="ficha-editable-label"
      style={{
        ...style,
        cursor: 'text',
        borderRadius: 3,
        padding: '1px 3px',
        margin: '-1px -3px',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.10)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {value || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{placeholder}</span>}
    </span>
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
        {isCompleted && onComplete ? (
          <button onClick={onComplete} style={{
            fontSize: 10, fontWeight: 600, color: D.textSecond,
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${D.cardBorder}`,
            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
          }}>
            ↺ Reabrir sección
          </button>
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
  /** Renombra el label (título) de una fila. */
  onLabelChange?: (rowId: string, newLabel: string) => void;
  /** Reordena filas: fromIndex y toIndex son posiciones en el array ordenado (allRows) */
  onReorderRow?: (fromIndex: number, toIndex: number) => void;
  isCompleted?: boolean;
  onComplete?: () => void;
}

// ── RoleCard ──────────────────────────────────────────────────────────────────

function RoleCard({
  title, rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, isCompleted, onComplete,
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
                <EditableLabel
                  value={row.label}
                  editable={editable}
                  onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                  style={S.roleLabel}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                  {editable ? (
                    <PersonCellInput
                      value={rawVal(row, colId)}
                      onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                      style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                    />
                  ) : (
                    <span style={{ ...S.roleValue, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                  )}
                  {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
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
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, isCompleted, onComplete,
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
                <EditableLabel
                  value={row.label}
                  editable={editable}
                  onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                  style={S.roleLabel}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                  {editable ? (
                    <PersonCellInput
                      value={rawVal(row, colId)}
                      onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                      style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                    />
                  ) : (
                    <span style={{ ...S.roleValue, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                  )}
                  {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
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
                        <EditableLabel
                          value={row.label}
                          editable={editable}
                          onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                          style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}
                        />
                      </div>
                      {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                    </div>
                    {editable ? (
                      <PersonCellInput
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
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, isCompleted, onComplete,
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
                  <PersonCellInput
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
                        {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                      </div>
                      {editable ? (
                        <PersonCellInput
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
                    <EditableLabel
                      value={row.label}
                      editable={editable}
                      onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                      style={{ fontSize: 11, color: D.textSecond, flexShrink: 0 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                      {editable ? (
                        <PersonCellInput
                          value={rawVal(row, colId)}
                          onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                          style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary, textAlign: 'right' }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 500, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                      )}
                      {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
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

// ── SongRowCell ───────────────────────────────────────────────────────────────

function SongRowCell({
  row, colId, editable, onCellChange, singers = [],
}: {
  row: Row;
  colId: string;
  editable?: boolean;
  onCellChange?: (rowId: string, colId: string, value: string) => void;
  singers?: string[];
}) {
  const raw    = rawVal(row, colId);
  const data   = parseSongData(raw);
  const eColId = effectiveColId(row, colId);

  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft,   setKeyDraft]   = useState(data.tonalidad);

  useEffect(() => { setKeyDraft(data.tonalidad); }, [data.tonalidad]);

  function update(patch: Partial<SongData>) {
    onCellChange?.(row.id, eColId, encodeSongData({ ...data, ...patch }));
  }

  const isRapida = data.tipo?.toLowerCase().includes('pida') ?? false;

  if (!editable) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: data.titulo ? D.textPrimary : D.textMuted }}>
          {data.titulo || '—'}
        </span>
        {(data.tipo || data.bpm) && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
            background: isRapida ? 'rgba(249,115,22,0.12)' : 'rgba(99,102,241,0.12)',
            color:      isRapida ? '#f97316' : '#6366f1' }}>
            {isRapida ? '⚡' : '✨'}{data.bpm ? ` ${data.bpm} BPM` : ''}
          </span>
        )}
        {data.tonalidad && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
            background: 'rgba(99,102,241,0.1)', color: '#6366f1', flexShrink: 0 }}>
            {data.tonalidad}
          </span>
        )}
        {data.cantante && (
          <span style={{ fontSize: 11, color: D.textSecond, flexShrink: 0 }}>{data.cantante}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Fila principal: título + tipo/bpm + tonalidad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SongInput
            value={data.titulo}
            onChange={(titulo) => update({ titulo })}
            onSongSelect={(c) => { if (c) update({ titulo: c.titulo, tipo: c.tipo, bpm: c.bpm }); }}
            placeholder="Nombre de la canción…"
          />
        </div>

        {/* Tipo + BPM (auto desde catálogo, no editable) */}
        {(data.tipo || data.bpm) && (
          <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
            background: isRapida ? 'rgba(249,115,22,0.12)' : 'rgba(99,102,241,0.12)',
            color:      isRapida ? '#f97316' : '#6366f1' }}>
            {isRapida ? '⚡' : '✨'}{data.bpm ? ` ${data.bpm}` : ''}
          </span>
        )}

        {/* Tonalidad — badge clickeable para editar */}
        {editingKey ? (
          <input
            autoFocus
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value.toUpperCase())}
            onBlur={() => { update({ tonalidad: keyDraft }); setEditingKey(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { update({ tonalidad: keyDraft }); setEditingKey(false); }
              if (e.key === 'Escape') { setKeyDraft(data.tonalidad); setEditingKey(false); }
            }}
            placeholder="Dm"
            style={{
              width: 40, fontSize: 11, fontWeight: 700, textAlign: 'center',
              background: 'rgba(99,102,241,0.1)', border: '1.5px solid rgba(99,102,241,0.5)',
              borderRadius: 5, color: '#6366f1', padding: '2px 4px', outline: 'none', flexShrink: 0,
            }}
          />
        ) : (
          <button
            onClick={() => { setKeyDraft(data.tonalidad); setEditingKey(true); }}
            title="Editar tonalidad"
            style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 5, fontWeight: 700, flexShrink: 0,
              background: data.tonalidad ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
              color:  data.tonalidad ? '#6366f1' : D.textMuted,
              border: `1px dashed ${data.tonalidad ? 'rgba(99,102,241,0.4)' : D.cardBorder}`,
              cursor: 'pointer',
            }}>
            {data.tonalidad || 'Key'}
          </button>
        )}
      </div>

      {/* Selector de cantante */}
      {singers.length > 0 && (
        <select
          value={data.cantante}
          onChange={(e) => update({ cantante: e.target.value })}
          style={{
            fontSize: 11, width: '100%',
            background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${D.cardBorder}`,
            borderRadius: 5, color: data.cantante ? D.textSecond : D.textMuted,
            padding: '3px 7px', outline: 'none', cursor: 'pointer',
          }}>
          <option value="">— Sin cantante asignado —</option>
          {singers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
    </div>
  );
}

// ── SetListCard ───────────────────────────────────────────────────────────────

function SetListCard({
  rows, colId, encuentro,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onReorderRow, isCompleted, onComplete,
  singers = [],
}: { rows: Row[]; encuentro: Encuentro | null; singers?: string[] } & EditProps) {
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
                display: 'flex', alignItems: 'flex-start', gap: 9,
                padding: '7px 0',
                borderBottom: i === displayed.length - 1 ? 'none' : `0.5px solid ${D.divider}`,
              }}>
                {handle}
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                  background: SONG_DOT_COLORS[i % SONG_DOT_COLORS.length], opacity: 0.85 }} />
                <SongRowCell
                  row={row} colId={colId} editable={editable}
                  onCellChange={onCellChange} singers={singers}
                />
                {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
              </div>
            )}
          </SortableRow>
        ))}
      </SortableSection>
      <SectionFooter sectionName="setList" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── CreatePaletteForm ─────────────────────────────────────────────────────────

const BLANK_COLORS: PaletaColor[] = Array.from({ length: 5 }, () => ({ name: '', hex: '#888888' }));

function CreatePaletteForm({ onCreated, onCancel }: { onCreated: (p: Paleta) => void; onCancel: () => void }) {
  const { mutate, isPending } = useCreatePaleta();
  const [name,   setName]   = useState('');
  const [colors, setColors] = useState<PaletaColor[]>(BLANK_COLORS);

  function setColor(i: number, field: keyof PaletaColor, value: string) {
    setColors((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutate({ name: trimmed, colors }, {
      onSuccess: (p) => onCreated(p),
    });
  }

  const inputBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: `1px solid ${D.cardBorder}`,
    borderRadius: 6, padding: '4px 8px', fontSize: 11, outline: 'none',
    color: D.textPrimary, width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      marginTop: 8, padding: '12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.cardBorder}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: D.textMuted, marginBottom: 10 }}>
        Nueva paleta
      </div>

      {/* Nombre */}
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Nombre de la paleta…"
        style={{ ...inputBase, marginBottom: 10, fontSize: 12 }}
      />

      {/* Colores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
        {colors.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {/* Color picker */}
            <label style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: c.hex,
                border: `1px solid rgba(255,255,255,0.18)`,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
              }} />
              <input
                type="color"
                value={c.hex}
                onChange={(e) => setColor(i, 'hex', e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              />
            </label>
            {/* Hex */}
            <input
              value={c.hex}
              onChange={(e) => setColor(i, 'hex', e.target.value)}
              placeholder="#000000"
              style={{ ...inputBase, width: 82, fontFamily: 'monospace', fontSize: 11 }}
            />
            {/* Nombre del color */}
            <input
              value={c.name}
              onChange={(e) => setColor(i, 'name', e.target.value)}
              placeholder={`Color ${i + 1}`}
              style={{ ...inputBase, flex: 1 }}
            />
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            fontSize: 11, fontWeight: 500, color: D.textSecond, background: 'none',
            border: `1px solid ${D.cardBorder}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={isPending || !name.trim()}
          style={{
            fontSize: 11, fontWeight: 600, color: '#fff',
            background: name.trim() ? C.purple : 'rgba(127,119,221,0.3)',
            border: 'none', borderRadius: 6, padding: '4px 12px',
            cursor: name.trim() ? 'pointer' : 'default',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Guardando…' : 'Guardar paleta'}
        </button>
      </div>
    </div>
  );
}

// ── OutfitPaletteSelector ─────────────────────────────────────────────────────

function OutfitPaletteSelector({
  selectedId, paletas, editable, onSelect, loading,
}: {
  selectedId: string;
  paletas:    Paleta[];
  editable?:  boolean;
  onSelect:   (id: string) => void;
  loading?:   boolean;
}) {
  // Estado local optimista: se actualiza inmediatamente al hacer click,
  // sin esperar a que el prop externo (que viene del backend) se propague.
  const [localId,     setLocalId]     = useState(selectedId);
  const [expanded,    setExpanded]    = useState(!selectedId);
  const [showCreate,  setShowCreate]  = useState(false);

  // Sincronizar si llega un cambio externo (ej: otro usuario edita)
  useEffect(() => {
    setLocalId(selectedId);
    if (!selectedId) setExpanded(true);
  }, [selectedId]);

  const selectedPaleta = paletas.find((p) => p.id === localId) ?? null;

  function pickPalette(id: string) {
    setLocalId(id);
    setExpanded(false);
    setShowCreate(false);
    onSelect(id);
  }

  function clearPalette() {
    setLocalId('');
    setExpanded(true);
    onSelect('');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ flex: 1, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
        ))}
      </div>
    );
  }

  /* ── Modo vista ── */
  if (!editable) {
    if (!selectedPaleta) return null;
    return (
      <div>
        <div style={{ fontSize: 11, color: D.textSecond, marginBottom: 8, fontWeight: 500 }}>
          {selectedPaleta.name}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {selectedPaleta.colors.map((c) => (
            <div key={c.name} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 36, borderRadius: 8, background: c.hex, border: '0.5px solid rgba(255,255,255,0.1)', marginBottom: 4 }} />
              <div style={{ fontSize: 9, color: D.textSecond, textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-word' }}>
                {c.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Modo edición: paleta seleccionada (colapsado) ── */
  if (selectedPaleta && !expanded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Swatches de la paleta seleccionada */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {selectedPaleta.colors.map((c) => (
            <div key={c.name} title={c.name} style={{
              width: 22, height: 22, borderRadius: 5, background: c.hex,
              border: '0.5px solid rgba(255,255,255,0.15)', flexShrink: 0,
            }} />
          ))}
        </div>
        {/* Nombre */}
        <span style={{ fontSize: 12, fontWeight: 600, color: D.textPrimary, flex: 1 }}>
          {selectedPaleta.name}
        </span>
        {/* Cambiar */}
        <button
          onClick={() => setExpanded(true)}
          style={{
            fontSize: 11, fontWeight: 500, color: C.purple,
            background: 'rgba(127,119,221,0.08)', border: `1px solid rgba(127,119,221,0.2)`,
            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
          }}
        >
          Cambiar
        </button>
        {/* Quitar selección */}
        <button
          onClick={clearPalette}
          title="Quitar selección"
          style={{ fontSize: 13, color: D.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = D.textMuted; }}
        >
          ✕
        </button>
      </div>
    );
  }

  /* ── Modo edición: selector expandido ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {paletas.map((p) => {
        const isSel = p.id === localId;
        return (
          <button
            key={p.id}
            onClick={() => pickPalette(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              background: isSel ? 'rgba(127,119,221,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isSel ? C.purple : D.cardBorder}`,
              transition: 'all 0.15s', textAlign: 'left',
            }}
            onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
          >
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {p.colors.map((c) => (
                <div key={c.name} title={c.name} style={{
                  width: 18, height: 18, borderRadius: 4, background: c.hex,
                  border: '0.5px solid rgba(255,255,255,0.12)', flexShrink: 0,
                }} />
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: isSel ? 600 : 400, color: isSel ? D.textPrimary : D.textSecond, flex: 1 }}>
              {p.name}
            </span>
            {isSel && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        );
      })}

      {/* Botón cancelar (si hay paleta seleccionada) */}
      {selectedPaleta && !showCreate && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            marginTop: 2, fontSize: 11, color: D.textMuted, background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left', padding: '2px 0',
          }}
        >
          ← Cancelar
        </button>
      )}

      {/* Crear nueva paleta */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          style={{
            marginTop: 4, fontSize: 11, color: D.textMuted, background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.purple; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = D.textMuted; }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Crear nueva paleta
        </button>
      ) : (
        <CreatePaletteForm
          onCreated={(p) => { pickPalette(p.id); setShowCreate(false); }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ── AddPositionBtn ────────────────────────────────────────────────────────────

function AddPositionBtn({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const submit = () => {
    const n = name.trim();
    if (n) onAdd(n);
    setName('');
    setOpen(false);
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      title="Agregar posición"
      style={{
        alignSelf: 'center', minWidth: 36, height: 36, borderRadius: 8,
        border: `1px dashed ${D.cardBorder}`, background: 'transparent',
        color: D.textMuted, fontSize: 20, cursor: 'pointer', lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = C.purple;
        (e.currentTarget as HTMLButtonElement).style.color = C.purple;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = D.cardBorder;
        (e.currentTarget as HTMLButtonElement).style.color = D.textMuted;
      }}
    >
      +
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { setOpen(false); setName(''); }
        }}
        placeholder="Nombre…"
        style={{
          background: 'rgba(255,255,255,0.06)', border: `1px solid ${D.cardBorder}`,
          borderRadius: 6, padding: '4px 8px', fontSize: 11, outline: 'none',
          color: D.textPrimary, width: 90,
        }}
      />
      <div style={{ display: 'flex', gap: 3 }}>
        <button onClick={submit} style={{
          flex: 1, background: C.purple, color: '#fff', border: 'none',
          borderRadius: 5, fontSize: 10, padding: '3px 0', cursor: 'pointer', fontWeight: 600,
        }}>
          Agregar
        </button>
        <button onClick={() => { setOpen(false); setName(''); }} style={{
          background: 'none', border: 'none', color: D.textSecond, fontSize: 12,
          cursor: 'pointer', padding: '0 3px',
        }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ── OutfitCard ────────────────────────────────────────────────────────────────

function OutfitCard({
  rows, colId,
  editable, paletas, paletasLoading,
  onCellChange, onAddRow, isCompleted, onComplete,
}: {
  rows:            Row[];
  paletas:         Paleta[];
  paletasLoading?: boolean;
} & Pick<EditProps, 'colId' | 'editable' | 'onCellChange' | 'onAddRow' | 'isCompleted' | 'onComplete'>) {
  const outfitRow = rows.find((r) => r.id === 'outfit_palette' || r.label === 'Paleta');
  const selectedId = outfitRow?.shared
    ? (outfitRow.values?.['shared'] ?? '')
    : (outfitRow?.values?.[colId] ?? '');

  const createdRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  // Flush pending selection once the row is created
  useEffect(() => {
    if (outfitRow && pendingRef.current !== null) {
      onCellChange?.(outfitRow.id, 'shared', pendingRef.current);
      pendingRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfitRow?.id]);

  function handleSelect(id: string) {
    if (outfitRow) {
      onCellChange?.(outfitRow.id, 'shared', id);
    } else {
      pendingRef.current = id;
      if (!createdRef.current && onAddRow) {
        createdRef.current = true;
        onAddRow('Paleta', 'text', true);
      }
    }
  }

  // View mode: nothing to show if no palette selected
  if (!editable && !selectedId) return null;

  return (
    <div className="ficha-card" style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.cardTitle}>Outfit / Paleta de Colores</div>
      <OutfitPaletteSelector
        selectedId={selectedId}
        paletas={paletas}
        editable={editable}
        onSelect={handleSelect}
        loading={paletasLoading && paletas.length === 0}
      />
      {editable && (
        <div className="ficha-no-print" style={{ marginTop: 10, borderTop: `0.5px solid ${D.divider}`, paddingTop: 8, textAlign: 'right' }}>
          {isCompleted && onComplete ? (
            <button onClick={onComplete} style={{
              fontSize: 10, fontWeight: 600, color: D.textSecond,
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${D.cardBorder}`,
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
            }}>
              ↺ Reabrir sección
            </button>
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
      )}
    </div>
  );
}

// ── WorshipSetListCard ────────────────────────────────────────────────────────

function WorshipSetListCard({
  escenaRows, setListRows, outfitRows,
  escena, setList, outfit,
  hideEscena, hideSetList, hideOutfit,
  paletas, paletasLoading,
}: {
  escenaRows:  Row[];
  setListRows: Row[];
  outfitRows:  Row[];
  escena:      EditProps;
  setList:     EditProps;
  outfit:      EditProps;
  hideEscena?:  boolean;
  hideSetList?: boolean;
  hideOutfit?:  boolean;
  paletas?:         Paleta[];
  paletasLoading?:  boolean;
}) {
  const editable     = escena.editable;
  const forceShowAll = escena.forceShowAll;
  const colId        = escena.colId;

  const commentRow = escenaRows.find((r) => r.id === 'esc_comment' || /comentarios?\s+del\s+productor/i.test(r.label));
  const bandaRows  = escenaRows.filter((r) => r !== commentRow);

  const displayedEscena = !hideEscena
    ? ((editable || forceShowAll) ? allRows(bandaRows) : rowsWithVal(bandaRows, colId))
    : [];
  const vio       = displayedEscena.find((r) => r.label === 'VIO');
  const positions = displayedEscena.filter((r) => /posición|posicion/i.test(r.label));
  const musicians = displayedEscena.filter((r) => r !== vio && !positions.includes(r));

  const displayedSetList = !hideSetList
    ? ((editable || forceShowAll) ? allRows(setListRows) : rowsWithVal(setListRows, colId))
    : [];

  // Cantantes disponibles: personas de escena que tienen un nombre asignado ese día
  const singers = allRows(bandaRows)
    .filter((r) => r.type === 'person')
    .map((r) => val(r, colId))
    .filter(Boolean);

  const commentValue = commentRow
    ? (commentRow.shared ? (commentRow.values?.['shared'] ?? '') : (commentRow.values?.[colId] ?? ''))
    : '';

  // ── Comment textarea (pending-value pattern for old fichas) ───────────────
  const [localComment, setLocalComment] = useState(commentValue);
  const commentCreatedRef = useRef(false);
  const pendingComment    = useRef<string | null>(null);

  useEffect(() => { setLocalComment(commentValue); }, [commentValue]);

  useEffect(() => {
    if (commentRow && pendingComment.current !== null) {
      escena.onCellChange?.(commentRow.id, 'shared', pendingComment.current);
      pendingComment.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentRow?.id]);

  function handleCommentChange(v: string) {
    setLocalComment(v);
    if (commentRow) {
      escena.onCellChange?.(commentRow.id, 'shared', v);
    } else {
      pendingComment.current = v;
    }
  }

  function ensureCommentRow() {
    if (!commentRow && !commentCreatedRef.current && escena.onAddRow) {
      commentCreatedRef.current = true;
      escena.onAddRow('Comentarios del Productor', 'text', true);
    }
  }

  // ── Outfit palette (pending-value pattern, data from outfit section) ───────
  const outfitRow = outfitRows.find((r) => r.id === 'outfit_palette' || r.label === 'Paleta');
  const outfitSelectedId = outfitRow?.shared
    ? (outfitRow.values?.['shared'] ?? '')
    : (outfitRow?.values?.[colId] ?? '');

  const outfitCreatedRef = useRef(false);
  const pendingOutfit    = useRef<string | null>(null);

  useEffect(() => {
    if (outfitRow && pendingOutfit.current !== null) {
      outfit.onCellChange?.(outfitRow.id, 'shared', pendingOutfit.current);
      pendingOutfit.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfitRow?.id]);

  function handleSelectPalette(id: string) {
    if (outfitRow) {
      outfit.onCellChange?.(outfitRow.id, 'shared', id);
    } else {
      pendingOutfit.current = id;
      if (!outfitCreatedRef.current && outfit.onAddRow) {
        outfitCreatedRef.current = true;
        outfit.onAddRow('Paleta', 'text', true);
      }
    }
  }

  const showOutfit = !hideOutfit && (editable || !!outfitSelectedId);

  const hasContent = displayedEscena.length > 0 || displayedSetList.length > 0 || showOutfit;
  if (!hasContent && !editable) return null;

  function SubDivider({ label }: { label: string }) {
    return (
      <div style={{ margin: '14px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: '0.5px', background: D.divider }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: D.textMuted }}>
          {label}
        </span>
        <div style={{ flex: 1, height: '0.5px', background: D.divider }} />
      </div>
    );
  }

  return (
    <div className="ficha-card" style={S.card}>
      {/* Header */}
      <div style={S.cardTitle}>
        AR Worship / Banda{(!editable && vio) ? ` — VIO: ${val(vio, colId)}` : ''}
      </div>

      {/* ── Banda ── */}
      {displayedEscena.length > 0 && (
        <SortableSection items={displayedEscena} onReorder={editable ? escena.onReorderRow : undefined}>
          {editable && vio && (
            <SortableRow id={vio.id} editable={editable}>
              {(handle) => (
                <div style={{ ...S.roleRow, marginBottom: 8 }}>
                  {handle}
                  <span style={S.roleLabel}>VIO</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                    <PersonCellInput
                      value={rawVal(vio, colId)}
                      onChange={(v) => escena.onCellChange?.(vio.id, effectiveColId(vio, colId), v)}
                      style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                    />
                    {escena.onDeleteRow && <DeleteBtn onClick={() => escena.onDeleteRow!(vio.id)} />}
                  </div>
                </div>
              )}
            </SortableRow>
          )}
          {(positions.length > 0 || editable) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
              {positions.map((row) => {
                const posLabel = row.label.replace(/posición\s*/i, '');
                return (
                  <SortableRow key={row.id} id={row.id} editable={editable}>
                    {(handle) => (
                      <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', background: D.badgeBg, borderRadius: 8, padding: '9px 4px', border: `0.5px solid ${D.cardBorder}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
                            {handle}
                            <div style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{posLabel}</div>
                          </div>
                          {editable && escena.onDeleteRow && !row.required && <DeleteBtn onClick={() => escena.onDeleteRow!(row.id)} />}
                        </div>
                        {editable ? (
                          <PersonCellInput
                            value={rawVal(row, colId)}
                            onChange={(v) => escena.onCellChange?.(row.id, effectiveColId(row, colId), v)}
                            placeholder="Nombre…"
                            multiline
                            rows={2}
                            style={{
                              fontSize: 12, fontWeight: 600, color: D.textPrimary,
                              textAlign: 'center', marginTop: 4, lineHeight: 1.45,
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: 12, fontWeight: 600, color: val(row, colId) ? D.textPrimary : D.textMuted, marginTop: 3, whiteSpace: 'pre-wrap', lineHeight: 1.45, textAlign: 'center' }}>
                            {val(row, colId) || '—'}
                          </div>
                        )}
                      </div>
                    )}
                  </SortableRow>
                );
              })}
              {editable && escena.onAddRow && (
                <AddPositionBtn
                  onAdd={(name) => escena.onAddRow!(`Posición ${name}`, 'person', true)}
                />
              )}
            </div>
          )}
          {musicians.length > 0 && (
            <div>
              {musicians.map((row) => (
                <SortableRow key={row.id} id={row.id} editable={editable}>
                  {(handle) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', gap: 8, borderBottom: `0.5px solid ${D.divider}` }}>
                      {handle}
                      <EditableLabel
                        value={row.label}
                        editable={editable}
                        onChange={escena.onLabelChange ? (v) => escena.onLabelChange!(row.id, v) : undefined}
                        style={{ fontSize: 11, color: D.textSecond, flexShrink: 0, minWidth: 120 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                        {editable ? (
                          <PersonCellInput
                            value={rawVal(row, colId)}
                            onChange={(v) => escena.onCellChange?.(row.id, effectiveColId(row, colId), v)}
                            style={{ fontSize: 13, fontWeight: 500, color: D.textPrimary, textAlign: 'right' }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 500, color: val(row, colId) ? D.textPrimary : D.textMuted, textAlign: 'right', wordBreak: 'break-word' }}>
                            {val(row, colId) || '—'}
                          </span>
                        )}
                        {editable && escena.onDeleteRow && !row.required && <DeleteBtn onClick={() => escena.onDeleteRow!(row.id)} />}
                      </div>
                    </div>
                  )}
                </SortableRow>
              ))}
            </div>
          )}
        </SortableSection>
      )}

      {/* Banda mini-footer */}
      {!hideEscena && editable && (
        <div className="ficha-no-print" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `0.5px solid ${D.divider}`, paddingTop: 8 }}>
          {escena.onAddRow && <AddRowInline sectionName="escena" onAdd={escena.onAddRow} />}
          <div>
            {escena.isCompleted && escena.onComplete ? (
              <button onClick={escena.onComplete} style={{ fontSize: 10, fontWeight: 600, color: D.textSecond, background: 'rgba(255,255,255,0.05)', border: `1px solid ${D.cardBorder}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                ↺ Reabrir banda
              </button>
            ) : escena.onComplete ? (
              <button onClick={escena.onComplete} style={{ fontSize: 10, fontWeight: 600, color: C.green, background: 'rgba(29,158,117,0.1)', border: `1px solid rgba(29,158,117,0.25)`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                ✓ Marcar banda
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Set List ── */}
      {!hideSetList && (
        <>
          <SubDivider label="Set List" />
          <SortableSection items={displayedSetList} onReorder={editable ? setList.onReorderRow : undefined}>
            {displayedSetList.map((row, i) => (
              <SortableRow key={row.id} id={row.id} editable={editable}>
                {(handle) => (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 0', borderBottom: i === displayedSetList.length - 1 ? 'none' : `0.5px solid ${D.divider}` }}>
                    {handle}
                    <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                      background: SONG_DOT_COLORS[i % SONG_DOT_COLORS.length], opacity: 0.85 }} />
                    <SongRowCell
                      row={row} colId={colId} editable={editable}
                      onCellChange={setList.onCellChange} singers={singers}
                    />
                    {editable && setList.onDeleteRow && !row.required && <DeleteBtn onClick={() => setList.onDeleteRow!(row.id)} />}
                  </div>
                )}
              </SortableRow>
            ))}
          </SortableSection>
          <SectionFooter sectionName="setList" editable={editable} isCompleted={setList.isCompleted} onAddRow={setList.onAddRow} onComplete={setList.onComplete} />
        </>
      )}

      {/* ── Outfit / Paleta ── */}
      {showOutfit && (
        <>
          <SubDivider label="Outfit / Paleta" />
          <OutfitPaletteSelector
            selectedId={outfitSelectedId}
            paletas={paletas ?? []}
            editable={editable}
            onSelect={handleSelectPalette}
            loading={paletasLoading && (paletas ?? []).length === 0}
          />
          {editable && (
            <div className="ficha-no-print" style={{ marginTop: 8, textAlign: 'right' }}>
              {outfit.isCompleted ? (
                <span style={{ fontSize: 10, fontWeight: 600, color: C.green }}>✓ Outfit completado</span>
              ) : outfit.onComplete ? (
                <button onClick={outfit.onComplete} style={{
                  fontSize: 10, fontWeight: 600, color: C.green,
                  background: 'rgba(29,158,117,0.1)', border: `1px solid rgba(29,158,117,0.25)`,
                  borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                }}>
                  ✓ Marcar completada
                </button>
              ) : null}
            </div>
          )}
        </>
      )}

      {/* ── Comentarios del Productor ── */}
      {(editable || commentValue) && (
        <>
          <SubDivider label="Comentarios del Productor" />
          {editable ? (
            <textarea
              value={localComment}
              onChange={(e) => handleCommentChange(e.target.value)}
              onFocus={ensureCommentRow}
              placeholder="Notas o instrucciones para este encuentro…"
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box' as const,
                background: 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${D.cardBorder}`,
                borderRadius: 8,
                color: D.textPrimary,
                fontSize: 12,
                fontFamily: 'inherit',
                padding: '8px 10px',
                resize: 'vertical' as const,
                outline: 'none',
                lineHeight: '1.5',
                colorScheme: 'dark' as any,
              }}
            />
          ) : (
            <p style={{ fontSize: 12, color: D.textPrimary, margin: 0, lineHeight: 1.6, padding: '4px 0', whiteSpace: 'pre-wrap' }}>
              {commentValue}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── HorariosCard ──────────────────────────────────────────────────────────────

function HorariosCard({
  rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={S.card}>
      <div style={S.cardTitle}>Horarios</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        {displayed.map((row, i) => {
          const { color, opacity } = timelineColor(row.label);
          const isBold    = /worship|vio|predicaci[oó]n|inicio/i.test(row.label);
          const timeValue = editable ? rawVal(row, colId) : val(row, colId);
          const hasTime   = !!timeValue;
          const isLast    = i === displayed.length - 1;

          return (
            <SortableRow key={row.id} id={row.id} editable={editable}>
              {(handle) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  padding: '0',
                  borderBottom: isLast ? 'none' : `0.5px solid ${D.divider}`,
                }}>
                  {handle}

                  {/* Columna de tiempo */}
                  <div style={{ width: 72, flexShrink: 0, paddingRight: 12, textAlign: 'right' }}>
                    {editable ? (
                      <CellInput
                        value={rawVal(row, colId)}
                        onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                        placeholder="00:00"
                        style={{
                          fontSize: 12, width: '100%', textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: isBold ? 700 : 400,
                          color: hasTime ? (isBold ? D.textPrimary : D.textSecond) : D.textMuted,
                        }}
                      />
                    ) : (
                      <span style={{
                        display: 'inline-block',
                        fontSize: 12,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: isBold ? 700 : 500,
                        color: hasTime ? (isBold ? D.textPrimary : D.textSecond) : D.textMuted,
                        background: hasTime && isBold ? 'rgba(255,255,255,0.06)' : 'transparent',
                        borderRadius: 5,
                        padding: hasTime && isBold ? '1px 5px' : '1px 0',
                      }}>
                        {timeValue || '—'}
                      </span>
                    )}
                  </div>

                  {/* Barra de color */}
                  <div style={{
                    width: 3, flexShrink: 0, borderRadius: 2,
                    alignSelf: 'stretch',
                    background: `linear-gradient(to bottom, transparent 10%, ${color} 30%, ${color} 70%, transparent 90%)`,
                    opacity: hasTime ? opacity : 0.25,
                    margin: '0 10px',
                  }} />

                  {/* Etiqueta */}
                  <EditableLabel
                    value={row.label}
                    editable={editable}
                    onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                    style={{
                      fontSize: 12, flex: 1, padding: '8px 0',
                      fontWeight: isBold ? 600 : 400,
                      color: isBold ? D.textPrimary : D.textSecond,
                      letterSpacing: isBold ? '-0.01em' : 'normal',
                    }}
                  />

                  {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
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
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={{ ...S.card, marginBottom: 0 }}>
      <div style={S.cardTitle}>Info Encuentro</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {displayed.map((row, i) => {
            const content = val(row, colId);
            return (
              <SortableRow key={row.id} id={row.id} editable={editable}>
                {(handle) => (
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 6,
                    padding: '5px 0',
                    borderBottom: i < displayed.length - 1 ? `0.5px solid ${D.divider}` : 'none',
                  }}>
                    {handle}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0 }}>
                      <EditableLabel
                        value={row.label}
                        editable={editable}
                        onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                        style={{
                          fontSize: 11, fontWeight: 600, color: D.textSecond,
                          whiteSpace: 'nowrap' as const,
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: D.textSecond }}>:</span>
                    </div>
                    {editable ? (
                      <>
                        <textarea
                          value={rawVal(row, colId)}
                          onChange={(e) => onCellChange?.(row.id, effectiveColId(row, colId), e.target.value)}
                          placeholder="Contenido del anuncio…"
                          rows={1}
                          style={{
                            flex: 1, boxSizing: 'border-box' as const,
                            background: 'transparent',
                            border: 'none', borderBottom: `1px dashed ${D.inputBorder}`,
                            outline: 'none', resize: 'none' as const,
                            fontFamily: 'inherit', fontSize: 12,
                            color: D.textPrimary, lineHeight: 1.45,
                            padding: '1px 0', caretColor: C.green,
                            overflow: 'hidden',
                            minHeight: 22,
                          }}
                          onInput={(e) => {
                            const t = e.currentTarget;
                            t.style.height = 'auto';
                            t.style.height = t.scrollHeight + 'px';
                          }}
                        />
                        {onDeleteRow && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                      </>
                    ) : (
                      <span style={{
                        fontSize: 12, color: content ? D.textPrimary : D.textMuted,
                        lineHeight: 1.45, whiteSpace: 'pre-wrap' as const,
                        wordBreak: 'break-word' as const,
                      }}>
                        {content || '—'}
                      </span>
                    )}
                  </div>
                )}
              </SortableRow>
            );
          })}
        </div>
      </SortableSection>
      <SectionFooter sectionName="anuncios" editable={editable} isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
    </div>
  );
}

// ── VoluntariosCard ───────────────────────────────────────────────────────────

function VoluntariosCard({
  rows, colId,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, isCompleted, onComplete,
}: { rows: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  if (!displayed.length && !editable) return null;

  return (
    <div className="ficha-card" style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.cardTitle}>Voluntarios de Servicio</div>
      <SortableSection items={displayed} onReorder={editable ? onReorderRow : undefined}>
        {displayed.map((row, i) => (
          <SortableRow key={row.id} id={row.id} editable={editable}>
            {(handle) => (
              <div style={{
                ...S.roleRow,
                ...(i === displayed.length - 1 ? { borderBottom: 'none' } : {}),
              }}>
                {handle}
                <EditableLabel
                  value={row.label}
                  editable={editable}
                  onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                  style={S.roleLabel}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                  {editable ? (
                    <PersonCellInput
                      value={rawVal(row, colId)}
                      onChange={(v) => onCellChange?.(row.id, effectiveColId(row, colId), v)}
                      style={{ ...S.roleValue, textAlign: 'right', width: '100%' }}
                    />
                  ) : (
                    <span style={{ ...S.roleValue, color: val(row, colId) ? D.textPrimary : D.textMuted }}>{val(row, colId) || '—'}</span>
                  )}
                  {editable && onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                </div>
              </div>
            )}
          </SortableRow>
        ))}
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

// ── Layout drag-to-reorder ────────────────────────────────────────────────────

type LayoutSlot = 'pastoral' | 'produccion' | 'media' | 'streaming' | 'horarios' | 'worship' | 'voluntarios' | 'anuncios';

/**
 * Grid de dos columnas con divisor arrastrable en modo edición.
 * Guarda el ratio (0.2–0.8) con debounce mientras se arrastra, y hace
 * commit inmediato al soltar el mouse.
 */
function ColumnResizeGrid({
  leftRatio,
  editable,
  onRatioChange,
  children,
}: {
  leftRatio: number;
  editable: boolean;
  onRatioChange: (r: number) => void;
  children: [React.ReactNode, React.ReactNode];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [localRatio, setLocalRatio] = React.useState(leftRatio);
  const [dragging, setDragging] = React.useState(false);

  // Sincronizar cuando cambia desde afuera (otro usuario editando)
  React.useEffect(() => {
    if (!dragging) setLocalRatio(leftRatio);
  }, [leftRatio, dragging]);

  React.useEffect(() => {
    if (!dragging) return;

    function onMove(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = (e.clientX - rect.left) / rect.width;
      const clamped = Math.min(0.8, Math.max(0.2, raw));
      setLocalRatio(clamped);
    }
    function onUp() {
      setDragging(false);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  // Al soltar, commit al backend (solo si cambió)
  React.useEffect(() => {
    if (dragging) return;
    if (Math.abs(localRatio - leftRatio) > 0.005) {
      onRatioChange(Math.round(localRatio * 100) / 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const divider = editable ? 6 : 0;
  const gap = 16;

  return (
    <div
      ref={containerRef}
      className="ficha-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: editable
          ? `${localRatio}fr ${divider}px ${1 - localRatio}fr`
          : `${localRatio}fr ${1 - localRatio}fr`,
        gap: editable ? `0 ${gap - divider - 4}px` : gap,
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0, paddingRight: editable ? 8 : 0, boxSizing: 'border-box' }}>{children[0]}</div>
      {editable && (
        <div
          role="separator"
          aria-orientation="vertical"
          title="Arrastra para ajustar el ancho de columnas"
          onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
          onDoubleClick={() => { setLocalRatio(0.5); onRatioChange(0.5); }}
          className="ficha-no-print"
          style={{
            cursor: 'col-resize',
            width: divider,
            alignSelf: 'stretch',
            background: dragging ? 'rgba(127,119,221,0.55)' : 'rgba(127,119,221,0.18)',
            borderRadius: 3,
            transition: 'background 0.15s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (!dragging) (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.35)';
          }}
          onMouseLeave={(e) => {
            if (!dragging) (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.18)';
          }}
        >
          {/* Grip visual central */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', gap: 3,
            pointerEvents: 'none',
          }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ width: 2, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.7)' }} />
            ))}
          </div>
        </div>
      )}
      <div style={{ minWidth: 0, paddingLeft: editable ? 8 : 0, boxSizing: 'border-box' }}>{children[1]}</div>
    </div>
  );
}

const DEFAULT_LAYOUT: { left: LayoutSlot[]; right: LayoutSlot[] } = {
  left:  ['pastoral', 'produccion', 'streaming', 'horarios'],
  right: ['worship', 'media', 'voluntarios', 'anuncios'],
};
const DEFAULT_LAYOUT_ORACION: { left: LayoutSlot[]; right: LayoutSlot[] } = {
  left:  ['pastoral', 'produccion', 'streaming', 'horarios'],
  right: ['worship', 'media'],
};

/** Columna droppable (target para soltar desde otra columna).
 * Importante: usar outline (fuera del box) en vez de box-shadow inset o
 * border, para que el drop visual NO empuje ni recalcule el layout de las
 * cards de adentro al empezar/terminar el drag.
 */
function DroppableColumn({ id, isDragging, children }: { id: string; isDragging?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const highlight = !!isDragging && isOver;
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 80,
        minWidth: 0,
        borderRadius: 10,
        transition: 'background 0.12s, outline-color 0.12s',
        background: highlight ? 'rgba(127,119,221,0.06)' : 'transparent',
        outline: '2px dashed transparent',
        outlineOffset: 2,
        outlineColor: highlight ? 'rgba(127,119,221,0.55)' : 'transparent',
      }}
    >
      {children}
    </div>
  );
}

/** Wrapper draggable alrededor de cada card de sección */
function DraggableSectionCard({ id, editMode, children }: { id: string; editMode?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.45 : 1,
        zIndex:     isDragging ? 100  : 'auto',
        position:   'relative',
      }}
    >
      {/* Handle de arrastre — siempre visible en modo edición */}
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="ficha-no-print"
          title="Arrastra para mover este módulo"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 20, cursor: isDragging ? 'grabbing' : 'grab',
            marginBottom: 2, borderRadius: '6px 6px 0 0',
            background: 'rgba(127,119,221,0.08)',
            border: '0.5px solid rgba(127,119,221,0.2)',
            transition: 'background 0.15s',
            touchAction: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.18)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.08)'; }}
        >
          <svg width="24" height="8" viewBox="0 0 24 8" fill="rgba(127,119,221,0.75)">
            <rect y="0" width="24" height="1.5" rx="1" />
            <rect y="3.5" width="24" height="1.5" rx="1" />
            <rect y="7" width="24" height="1" rx="0.5" opacity="0.6" />
          </svg>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: 'rgba(127,119,221,0.85)', textTransform: 'uppercase',
          }}>
            Mover
          </span>
        </div>
      )}
      {children}
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
  onLabelChange?: (section: SectionName, rowId: string, newLabel: string) => void;
  onReorderRow?: (section: SectionName, fromIndex: number, toIndex: number) => void;
  onSectionComplete?: (section: SectionName) => void;
  sectionStatus?: Partial<Record<SectionName, boolean>>;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  hiddenSections?: SectionName[];
  onToggleModule?: (name: SectionName) => void;
  sectionLayout?: { left: string[]; right: string[]; leftRatio?: number };
  onUpdateLayout?: (layout: { left: string[]; right: string[]; leftRatio?: number }) => void;
}

export function FichaDocumentView({
  ficha, onEdit, onSave, onArchive, onUnarchive, canArchive,
  onPublish, onUnpublish, canPublish, isPublishing,
  editable, forceShowAll, localSections, onCellChange, onAddRow, onDeleteRow, onLabelChange, onReorderRow, onSectionComplete,
  sectionStatus, saveState, hiddenSections, onToggleModule,
  sectionLayout: sectionLayoutProp, onUpdateLayout,
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
    onLabelChange: onLabelChange ? (rowId, newLabel) => onLabelChange(name, rowId, newLabel)          : undefined,
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

  // ── Layout drag-to-reorder ────────────────────────────────────────────────
  const defaultLayout = ficha.type === 'oracion' ? DEFAULT_LAYOUT_ORACION : DEFAULT_LAYOUT;
  const storedLayout = (sectionLayoutProp ?? defaultLayout) as { left: LayoutSlot[]; right: LayoutSlot[]; leftRatio?: number };
  const layoutHasMedia = [...storedLayout.left, ...storedLayout.right].includes('media');
  const resolvedLayout: { left: LayoutSlot[]; right: LayoutSlot[]; leftRatio: number } = {
    left:  layoutHasMedia ? storedLayout.left  : [...storedLayout.left],
    right: layoutHasMedia ? storedLayout.right : [...storedLayout.right, 'media'],
    leftRatio: Math.min(0.8, Math.max(0.2, storedLayout.leftRatio ?? 0.5)),
  };

  const [activeSlot, setActiveSlot] = useState<LayoutSlot | null>(null);
  // Ancho de la card que se está arrastrando, para que el DragOverlay
  // no aparezca del ancho del viewport y rompa el layout.
  const [activeWidth, setActiveWidth] = useState<number | null>(null);

  // Layout local optimista: durante el drag se actualiza en tiempo real
  // en onDragOver para dar preview visual del cambio. Al soltar (dragEnd)
  // se commitea al backend. Si el usuario cancela, se resetea desde el prop.
  const [draftLayout, setDraftLayout] = useState<{ left: LayoutSlot[]; right: LayoutSlot[] } | null>(null);

  const layoutSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Helpers ────────────────────────────────────────────────────────────────
  // Los IDs que dnd-kit maneja son de dos tipos:
  //   1. IDs de columna: "left" | "right" (usados por DroppableColumn)
  //   2. IDs de slot: 'pastoral' | 'produccion' | ... (LayoutSlot)
  // sideOf() unifica ambos casos y devuelve la columna a la que pertenece,
  // o null si es un ID desconocido (defensa contra collision detection raro).
  type Side = 'left' | 'right';
  function sideOf(id: string, layout: { left: LayoutSlot[]; right: LayoutSlot[] }): Side | null {
    if (id === 'left'  || layout.left.includes(id as LayoutSlot))  return 'left';
    if (id === 'right' || layout.right.includes(id as LayoutSlot)) return 'right';
    return null;
  }

  function handleLayoutDragStart({ active }: DragStartEvent) {
    const id = active.id as string;
    // Solo aceptar como active un slot válido (defensa por si un item de
    // otro SortableContext anidado dispara este handler).
    if (sideOf(id, resolvedLayout) === null) return;
    setActiveSlot(id as LayoutSlot);
    const rect = active.rect.current.initial ?? active.rect.current.translated;
    if (rect?.width) setActiveWidth(rect.width);
    // Inicializar el draft con el layout actual (sin ratio; ratio se
    // maneja aparte y no cambia durante el drag).
    setDraftLayout({ left: [...resolvedLayout.left], right: [...resolvedLayout.right] });
  }

  // Recalcula el layout dado un evento de over. Devuelve null si nada cambia.
  function computeLayout(
    activeId: LayoutSlot,
    overId: string,
    layout: { left: LayoutSlot[]; right: LayoutSlot[] },
  ): { left: LayoutSlot[]; right: LayoutSlot[] } | null {
    if (activeId === overId) return null;
    const activeSide = sideOf(activeId, layout);
    const overSide   = sideOf(overId,   layout);
    if (!activeSide || !overSide) return null;

    // — Mismo lado: reordenar dentro de la columna —
    if (activeSide === overSide) {
      const col   = activeSide === 'left' ? layout.left : layout.right;
      const from  = col.indexOf(activeId);
      const overIsColumnItself = overId === activeSide;
      const to    = overIsColumnItself ? col.length - 1 : col.indexOf(overId as LayoutSlot);
      if (from === -1 || to === -1 || from === to) return null;
      const moved = arrayMove(col, from, to);
      return activeSide === 'left'
        ? { left: moved, right: layout.right }
        : { left: layout.left, right: moved };
    }

    // — Lados distintos: mover activeId de un lado al otro —
    const fromCol = activeSide === 'left' ? layout.left : layout.right;
    const toCol   = overSide   === 'left' ? layout.left : layout.right;
    const newFrom = fromCol.filter((s) => s !== activeId);
    const overIsColumnItself = overId === overSide;
    // Si over es la columna en sí (vacía o zona debajo de todo), insertar al final.
    // Si over es un slot, insertar en la posición de ese slot (empujándolo hacia abajo).
    const insertAt = overIsColumnItself
      ? toCol.length
      : Math.max(0, toCol.indexOf(overId as LayoutSlot));
    const newTo = [...toCol];
    newTo.splice(insertAt, 0, activeId);
    // overSide indica LA COLUMNA DESTINO. La otra columna es la de origen.
    return overSide === 'left'
      ? { left: newTo,  right: newFrom }  // der → izq
      : { left: newFrom, right: newTo };  // izq → der
  }

  function handleLayoutDragOver({ active, over }: DragOverEvent) {
    if (!over || !draftLayout) return;
    const activeId = active.id as LayoutSlot;
    const overId   = over.id as string;
    const next = computeLayout(activeId, overId, draftLayout);
    if (next) setDraftLayout(next);
  }

  function handleLayoutDragEnd({ active, over }: DragEndEvent) {
    const finalDraft = draftLayout;
    setActiveSlot(null);
    setActiveWidth(null);
    setDraftLayout(null);
    if (!over || !onUpdateLayout || !finalDraft) return;

    const layout = resolvedLayout;
    // Solo commit si algo cambió respecto al estado real actual.
    const changed =
      finalDraft.left.join(',')  !== layout.left.join(',') ||
      finalDraft.right.join(',') !== layout.right.join(',');
    if (!changed) return;
    onUpdateLayout({ left: finalDraft.left, right: finalDraft.right, leftRatio: layout.leftRatio });
  }

  function handleLayoutDragCancel() {
    setActiveSlot(null);
    setActiveWidth(null);
    setDraftLayout(null);
  }

  const { paletas, loading: paletasLoading } = usePaletas();

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
    return toFichaInputDate(raw);
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
  const isSaveError = saveState === 'error';

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

          {/* Fila 2: campus + título en su propia fila, botones debajo */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            padding: '1rem 2rem 1.2rem', gap: 12,
          }}>
            {/* Campus + título */}
            <div style={{ minWidth: 0 }}>
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
            <div className="ficha-no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

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
                    background: isSaveError ? 'rgba(220,38,38,0.15)' : isSaved ? C.green : 'rgba(255,255,255,0.1)',
                    color: isSaveError ? '#f87171' : D.textPrimary,
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  {isSaving ? (
                    <>
                      <svg style={{ animation: 'spin 1s linear infinite' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Guardando…
                    </>
                  ) : isSaveError ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      Error al guardar
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
                      {(SECTIONS_BY_TYPE[ficha.type] ?? Object.keys(SECTION_LABELS) as SectionName[]).map((name) => {
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
          {(() => {
            // Función que renderiza una slot de sección
            const renderSlot = (slot: LayoutSlot) => {
              switch (slot) {
                case 'pastoral':
                  return !hidden('pastoral') ? <RoleCard key="pastoral" title="Equipo Pastoral" rows={sec('pastoral')} {...editProps('pastoral')} /> : null;
                case 'produccion':
                  return !hidden('produccion') ? <RoleCard key="produccion" title="Producción" rows={sec('produccion')} {...editProps('produccion')} /> : null;
                case 'media':
                  return !hidden('media') ? <RoleCard key="media" title="Media" rows={sec('media')} {...editProps('media')} /> : null;
                case 'streaming':
                  return !hidden('streaming') ? <StreamingCard key="streaming" rows={sec('streaming')} {...editProps('streaming')} /> : null;
                case 'horarios':
                  return !hidden('horarios') ? <HorariosCard key="horarios" rows={sec('horarios')} {...editProps('horarios')} /> : null;
                case 'worship':
                  return (!hidden('escena') || !hidden('setList') || !hidden('outfit')) ? (
                    <WorshipSetListCard
                      key="worship"
                      escenaRows={sec('escena')} setListRows={sec('setList')} outfitRows={sec('outfit')}
                      escena={editProps('escena')} setList={editProps('setList')} outfit={editProps('outfit')}
                      hideEscena={hidden('escena')} hideSetList={hidden('setList')} hideOutfit={hidden('outfit')}
                      paletas={paletas} paletasLoading={paletasLoading}
                    />
                  ) : null;
                case 'voluntarios':
                  return !hidden('voluntarios') ? <VoluntariosCard key="voluntarios" rows={sec('voluntarios')} {...editProps('voluntarios')} /> : null;
                case 'anuncios':
                  return !hidden('anuncios') ? <AnunciosCard key="anuncios" rows={sec('anuncios')} {...editProps('anuncios')} /> : null;
                default: return null;
              }
            };

            // Un slot está "oculto" cuando todas sus secciones internas están
            // en hiddenSections. 'worship' es especial porque agrupa 3 secciones
            // (escena + setList + outfit); los demás mapean 1:1.
            const slotIsHidden = (slot: LayoutSlot): boolean => {
              if (slot === 'worship') {
                return hidden('escena') && hidden('setList') && hidden('outfit');
              }
              return hidden(slot as SectionName);
            };

            // Durante el drag preferimos draftLayout (preview optimista); al
            // soltar volvemos a resolvedLayout. Filtramos ocultos ANTES del
            // map para no dejar wrappers "MOVER" huérfanos.
            const activeLayout = draftLayout ?? { left: resolvedLayout.left, right: resolvedLayout.right };
            const visibleLeft  = activeLayout.left.filter((s) => !slotIsHidden(s));
            const visibleRight = activeLayout.right.filter((s) => !slotIsHidden(s));

            // Todos los slots de ambas columnas como IDs para los SortableContext
            const allSlots = [...visibleLeft, ...visibleRight];

            // Collision detection robusta para arrastrar entre SortableContext
            // distintos (izquierda ↔ derecha).
            //
            // Estrategia: primero probamos con el puntero exacto (más preciso),
            // luego con intersección de rectángulos, y como último recurso con
            // closestCorners. Si el resultado no está sobre una card ni sobre
            // el contenedor de columna, forzamos "left" o "right" según qué
            // lado del contenedor esté más cerca del puntero.
            const detectCollisions: CollisionDetection = (args) => {
              const pointer = pointerWithin(args);
              if (pointer.length > 0) return pointer;
              const rects = rectIntersection(args);
              if (rects.length > 0) return rects;
              return closestCorners(args);
            };

            return (
              <DndContext
                sensors={layoutSensors}
                collisionDetection={detectCollisions}
                onDragStart={handleLayoutDragStart}
                onDragOver={handleLayoutDragOver}
                onDragEnd={handleLayoutDragEnd}
                onDragCancel={handleLayoutDragCancel}
              >
                <ColumnResizeGrid
                  leftRatio={resolvedLayout.leftRatio}
                  editable={!!editable && !!onUpdateLayout}
                  onRatioChange={(r) => onUpdateLayout?.({ left: resolvedLayout.left, right: resolvedLayout.right, leftRatio: r })}
                >
                  {/* Columna izquierda */}
                  <SortableContext items={visibleLeft} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id="left" isDragging={!!activeSlot}>
                      {visibleLeft.map((slot) => (
                        <DraggableSectionCard key={slot} id={slot} editMode={editable && !!onUpdateLayout}>
                          {renderSlot(slot)}
                        </DraggableSectionCard>
                      ))}
                    </DroppableColumn>
                  </SortableContext>

                  {/* Columna derecha */}
                  <SortableContext items={visibleRight} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id="right" isDragging={!!activeSlot}>
                      {visibleRight.map((slot) => (
                        <DraggableSectionCard key={slot} id={slot} editMode={editable && !!onUpdateLayout}>
                          {renderSlot(slot)}
                        </DraggableSectionCard>
                      ))}
                    </DroppableColumn>
                  </SortableContext>
                </ColumnResizeGrid>

                {/* Ghost overlay mientras se arrastra — ancho fijo capturado
                    del rect original para que no tome el ancho del viewport
                    y rompa la percepción del layout durante el drag. */}
                <DragOverlay
                  dropAnimation={null}
                  style={activeWidth ? { width: activeWidth } : undefined}
                >
                  {activeSlot && (
                    <div style={{
                      opacity: 0.9,
                      cursor: 'grabbing',
                      pointerEvents: 'none',
                      width: activeWidth ?? '100%',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                      borderRadius: 12,
                    }}>
                      {renderSlot(activeSlot)}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            );
          })()}
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
