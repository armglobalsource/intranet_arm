'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Ficha, Row, SectionName, Encuentro, LayoutVisualSlot } from '@/types/ficha';
import { SECTION_LABELS } from '@/types/ficha';
import { SongInput } from '@/components/fichas/SongInput';
import { LayoutVisualView } from './LayoutVisualView';
import { useUsers } from '@/hooks/useUsers';
import { displayName } from '@/types/user';
import { useRosterStatus } from '@/components/fichas/RosterStatusContext';
import type { RosterStatus } from '@/types/disponibilidad';
import { SortableSection, SortableRow, SortableFichaLayout } from '@/components/fichas/FichaSortable';

// Secciones disponibles por tipo de ficha (para el panel de módulos)
const SECTIONS_BY_TYPE: Record<string, SectionName[]> = {
  unico:   ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit'],
  multi:   ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit'],
  oracion: ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'outfit'],
};
import { useChangelog, useUpdateFicha } from '@/hooks/useFichas';
import { FichaQuickView } from '@/components/fichas/FichaQuickView';
import { FichaCompareView } from '@/components/fichas/FichaCompareView';
import { EncuentrosEditor, type EncuentroDraft } from '@/components/fichas/EncuentrosEditor';
import { sameLocalDay } from '@/lib/ficha-summary';
import {
  MOMENT_KINDS, cleanLabel, durationMinutes, encodeMoment, formatRange, hasContent, kindInfo, momentTree,
  parseMoment, toMinutes, withDuration,
  type MomentKind, type MomentLink, type MomentValue, type ParsedMoment,
} from '@/lib/ficha-timing';
import { parseFichaDate as parseLocalDate, toFichaInputDate } from '@/lib/ficha-date';
import { usePaletas, useCreatePaleta, type Paleta, type PaletaColor } from '@/hooks/usePaletas';

// ── Paleta ────────────────────────────────────────────────────────────────────

const C = {
  purple: '#6554C0',
  green:  '#087F5B',
  amber:  '#D4890A',
  gray:   '#6b6b6b',
} as const;

const SONG_DOT_COLORS = [C.purple, C.green, C.green, C.green, C.amber, C.gray];

// ── Tema claro de la ficha ─────────────────────────────────────────────────────

const D = {
  bg:          '#F4F6F9',
  cardBg:      '#FFFFFF',
  cardBorder:  '#DEE3EB',
  divider:     '#EDF0F4',
  headerBg:    '#FFFFFF',
  badgeBg:     '#F1F3F8',
  textPrimary: '#243047',
  textSecond:  '#526078',
  textMuted:   '#69768B',
  inputBorder: '#CCD4E1',
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

// ── Estilos base ──────────────────────────────────────────────────────────────

const S = {
  card: {
    background: D.cardBg,
    border: `0.5px solid ${D.cardBorder}`,
    borderRadius: 12,
    padding: '1rem 1.1rem',
    marginBottom: 14,
    boxShadow: '0 2px 5px rgba(36,48,71,0.03)',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', color: D.textSecond, marginBottom: 14,
  } as React.CSSProperties,
  roleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: `0.5px solid ${D.divider}`,
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

const ROSTER_DOT_COLOR: Record<RosterStatus, string> = {
  disponible:     '#1D9E75',
  no_disponible:  '#D14343',
  sin_responder:  '#6b6b6b',
};

const ROSTER_DOT_TITLE: Record<RosterStatus, string> = {
  disponible:    'Disponible esta semana',
  no_disponible: 'No disponible esta semana',
  sin_responder: 'Sin respuesta esta semana',
};

function RosterDot({ status }: { status?: RosterStatus }) {
  if (!status) return null;
  return (
    <span
      title={ROSTER_DOT_TITLE[status]}
      style={{
        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
        background: ROSTER_DOT_COLOR[status], flexShrink: 0,
      }}
    />
  );
}

function PersonCellInput({ value, onChange, placeholder, style, multiline, rows }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  rows?: number;
}) {
  const { data: users = [] } = useUsers();
  const rosterStatus = useRosterStatus();
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Las tarjetas de posiciones son deliberadamente compactas. Un textarea
  // con altura fija termina mostrando la barra nativa del navegador apenas el
  // nombre ocupa dos líneas. Ajustamos su alto al contenido para mantener la
  // lectura limpia y evitar que el control parezca un selector antiguo.
  useEffect(() => {
    if (!multiline || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight + 1}px`;
    };
    resize();
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth !== width) {
        width = textarea.clientWidth;
        resize();
      }
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [multiline, value]);

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
        <textarea
          ref={textareaRef}
          rows={rows ?? 2}
          {...sharedProps}
          onInput={(e) => {
            const textarea = e.currentTarget;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight + 1}px`;
          }}
          style={{
            ...sharedProps.style,
            display: 'block',
            boxSizing: 'border-box',
            minHeight: '2.9em',
            overflow: 'hidden',
            resize: 'none',
          }}
        />
      ) : (
        <input type="text" {...sharedProps} />
      )}
      {showDrop && (
        <div
          className="ficha-no-print"
          style={{
            position: 'absolute', zIndex: 50, left: 0, right: 0, top: '100%', marginTop: 3,
            background: D.cardBg, border: `1px solid ${D.cardBorder}`, borderRadius: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)', maxHeight: 180, overflowY: 'auto', textAlign: 'left',
          }}
        >
          {suggestions.map((u) => {
            const blocked = rosterStatus[u.id] === 'no_disponible';
            return (
              <button
                key={u.id}
                type="button"
                disabled={blocked}
                title={blocked ? 'No disponible esta semana — no se puede seleccionar' : undefined}
                onMouseDown={(e) => {
                  if (blocked) { e.preventDefault(); return; }
                  onChange(displayName(u)); setOpen(false);
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 10px', background: 'transparent', border: 'none',
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  opacity: blocked ? 0.45 : 1,
                  borderBottom: `1px solid ${D.divider}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RosterDot status={rosterStatus[u.id]} />
                  <div style={{ fontSize: 12, fontWeight: 500, color: D.textPrimary, textDecoration: blocked ? 'line-through' : 'none' }}>
                    {displayName(u)}
                  </div>
                </div>
                {u.email && <div style={{ fontSize: 10, color: D.textMuted, marginLeft: 13 }}>{u.email}</div>}
              </button>
            );
          })}
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
        flexShrink: 0, fontSize: 11, lineHeight: 1, color: D.textMuted,
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = D.textMuted; }}
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
      type="button"
      className="ficha-add-row"
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
  /** Identidades estables, incluso cuando se muestra solo una parte de la sección. */
  onReorderRow?: (activeId: string, overId: string) => void;
  isCompleted?: boolean;
  onComplete?: () => void;
  /** Cambia propiedades de la fila completa (por ahora, parentId en el timing). */
  onRowPatch?: (rowId: string, patch: Partial<Row>) => void;
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
        <>
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
            <SortableSection items={positions} onReorder={editable ? escena.onReorderRow : undefined}>
            <div className="ficha-positions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
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
            </SortableSection>
          )}
          {musicians.length > 0 && (
            <SortableSection items={musicians} onReorder={editable ? escena.onReorderRow : undefined}>
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
            </SortableSection>
          )}
        </>
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

// ── TimingCard ────────────────────────────────────────────────────────────────
// Horarios como timing estructurado: inicio–término, duración, tipo,
// responsable, indicaciones y vínculo a una noticia (Info Encuentro) o a una
// canción (Set List). Los sub-momentos cuelgan de un momento principal.

function songText(row: Row | undefined, colId: string): string {
  if (!row) return '';
  const s = parseSongData(val(row, colId));
  return [s.titulo || row.label, s.tonalidad && `(${s.tonalidad})`, s.cantante && `· ${s.cantante}`].filter(Boolean).join(' ');
}

const timingBadge = (color: string): React.CSSProperties => ({
  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  color, background: `${color}14`, border: `1px solid ${color}33`, borderRadius: 999, padding: '0 6px', lineHeight: '16px',
});

const timingSelect: React.CSSProperties = {
  fontSize: 11, color: D.textSecond, background: '#fff', border: `1px solid ${D.inputBorder}`,
  borderRadius: 6, padding: '2px 4px', maxWidth: 190, fontFamily: 'inherit',
};

const timingTime: React.CSSProperties = {
  fontSize: 12, fontVariantNumeric: 'tabular-nums', color: D.textPrimary, background: 'transparent',
  border: 'none', borderBottom: `1px dashed ${D.inputBorder}`, outline: 'none', padding: '1px 0', width: 78, fontFamily: 'inherit',
};

function TimingCard({
  rows, colId, encuentros, anunciosRows, setListRows, fichaDate,
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, onRowPatch, isCompleted, onComplete,
}: { rows: Row[]; encuentros: Encuentro[]; anunciosRows: Row[]; setListRows: Row[]; fichaDate?: any } & EditProps) {
  const [comparing, setComparing] = useState(false);
  const [openLink, setOpenLink] = useState<string | null>(null);
  // La hora actual se lee recién en el navegador para no desalinear el render del servidor.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const songs = setListRows.filter((r) => parseSongData(val(r, colId)).titulo);

  // ── Edición ──
  if (editable) {
    const displayed = allRows(rows);
    const ids = new Set(displayed.map((r) => r.id));
    const isChild = (r: Row) => !!r.parentId && r.parentId !== r.id && ids.has(r.parentId);
    const roots = displayed.filter((r) => !isChild(r));
    const hasChildren = (id: string) => displayed.some((r) => r.parentId === id);

    const write = (p: ParsedMoment, patch: Partial<MomentValue>) => {
      onCellChange?.(p.row.id, effectiveColId(p.row, colId), encodeMoment({ ...p.value, ...patch }));
      // Al pasar al formato nuevo, el rango escrito en el nombre ya no hace falta.
      if (p.legacy && p.label !== p.row.label && (p.row.shared || encuentros.length <= 1)) onLabelChange?.(p.row.id, p.label);
    };

    return (
      <div className="ficha-card" style={S.card}>
        <div style={S.cardTitle}>Timing</div>
        <SortableSection items={displayed} onReorder={onReorderRow}>
          {displayed.map((row, i) => {
            const p = parseMoment(row, colId);
            const child = isChild(row);
            const dur = durationMinutes(p.value);
            const k = kindInfo(p.value.tipo);
            const link = p.value.enlace ? `${p.value.enlace.seccion}:${p.value.enlace.rowId}` : '';
            return (
              <SortableRow key={row.id} id={row.id} editable>
                {(handle) => (
                  <div data-timing-row={row.id} style={{
                    padding: '7px 0 7px 8px', marginLeft: child ? 22 : 0,
                    borderLeft: `3px solid ${k.color}`,
                    borderBottom: i === displayed.length - 1 ? 'none' : `0.5px solid ${D.divider}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {handle}
                      <EditableLabel
                        value={row.label}
                        editable
                        onChange={onLabelChange ? (v) => onLabelChange(row.id, v) : undefined}
                        style={{ fontSize: 12, flex: 1, minWidth: 0, fontWeight: child ? 400 : 600, color: D.textPrimary }}
                      />
                      {onDeleteRow && !row.required && <DeleteBtn onClick={() => onDeleteRow(row.id)} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      <input
                        type="time" aria-label="Inicio" value={p.value.inicio ?? ''} style={timingTime}
                        onChange={(e) => {
                          const inicio = e.target.value || undefined;
                          // Mover el inicio conserva la duración.
                          write(p, dur != null && inicio ? withDuration({ ...p.value, inicio }, dur) : { inicio });
                        }}
                      />
                      <span style={{ fontSize: 11, color: D.textMuted }}>a</span>
                      <input
                        type="time" aria-label="Término" value={p.value.fin ?? ''} style={timingTime}
                        onChange={(e) => write(p, { fin: e.target.value || undefined })}
                      />
                      <input
                        type="number" min={0} max={600} aria-label="Duración en minutos" placeholder="min"
                        value={dur ?? ''} disabled={!p.value.inicio}
                        onChange={(e) => write(p, withDuration(p.value, e.target.value === '' ? null : Number(e.target.value)))}
                        style={{ ...timingTime, width: 46, textAlign: 'right' }}
                      />
                      <span style={{ fontSize: 11, color: D.textMuted }}>min</span>
                    </div>
                    <div className="ficha-no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                      <select aria-label="Tipo" value={p.value.tipo ?? 'momento'} style={timingSelect}
                        onChange={(e) => write(p, { tipo: e.target.value as MomentKind })}>
                        {MOMENT_KINDS.map((m) => <option key={m.kind} value={m.kind}>{m.label}</option>)}
                      </select>
                      <div style={{ width: 170 }}>
                        <PersonCellInput
                          value={p.value.responsable ?? ''} placeholder="Responsable"
                          onChange={(v) => write(p, { responsable: v })}
                          style={{ fontSize: 11.5 }}
                        />
                      </div>
                      <select aria-label="Vínculo" value={link} style={timingSelect}
                        onChange={(e) => {
                          const [seccion, rowId] = e.target.value.split(':');
                          write(p, { enlace: rowId ? { seccion: seccion as MomentLink['seccion'], rowId } : undefined });
                        }}>
                        <option value="">Sin vínculo</option>
                        {anunciosRows.length > 0 && (
                          <optgroup label="Info Encuentro">
                            {allRows(anunciosRows).map((r) => <option key={r.id} value={`anuncios:${r.id}`}>{r.label}</option>)}
                          </optgroup>
                        )}
                        {songs.length > 0 && (
                          <optgroup label="Set List">
                            {allRows(songs).map((r) => <option key={r.id} value={`setList:${r.id}`}>{songText(r, colId)}</option>)}
                          </optgroup>
                        )}
                      </select>
                      {onRowPatch && (
                        <select aria-label="Sub-momento de" value={child ? row.parentId! : ''} style={timingSelect}
                          disabled={hasChildren(row.id)}
                          title={hasChildren(row.id) ? 'Este momento ya tiene sub-momentos' : 'Colgar este momento de otro'}
                          onChange={(e) => onRowPatch(row.id, { parentId: e.target.value || null })}>
                          <option value="">Momento principal</option>
                          {roots.filter((r) => r.id !== row.id).map((r) => (
                            <option key={r.id} value={r.id}>Sub-momento de {cleanLabel(r.label)}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <CellInput
                      value={p.value.nota ?? ''} placeholder="Indicaciones para el equipo…"
                      onChange={(v) => write(p, { nota: v })}
                      style={{ fontSize: 11.5, color: D.textSecond, marginTop: 5 }}
                    />
                  </div>
                )}
              </SortableRow>
            );
          })}
        </SortableSection>
        <SectionFooter sectionName="horarios" editable isCompleted={isCompleted} onAddRow={onAddRow} onComplete={onComplete} />
      </div>
    );
  }

  // ── Lectura ──
  const tree = momentTree(rows, colId, true)
    .map((n) => ({ ...n, children: n.children.filter((c) => forceShowAll || hasContent(c.value)) }))
    .filter((n) => forceShowAll || hasContent(n.value) || n.children.length > 0);
  if (!tree.length) return null;

  // Momento en curso y siguiente, solo el día del encuentro.
  let currentId: string | null = null, nextId: string | null = null;
  const isEventDay = !!now && !!fichaDate && sameLocalDay(parseLocalDate(fichaDate), now);
  if (isEventDay && now) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const n of tree) {
      const start = toMinutes(n.value.inicio);
      if (start == null) continue;
      if (start <= nowMin) {
        const end = toMinutes(n.value.fin);
        currentId = end == null || end <= start || nowMin < end ? n.row.id : null;
      } else { nextId = n.row.id; break; }
    }
  }

  const linkChip = (m: ParsedMoment) => {
    const link = m.value.enlace;
    if (!link) return null;
    if (link.seccion === 'anuncios') {
      const target = anunciosRows.find((r) => r.id === link.rowId);
      if (!target) return null;
      const key = `${m.row.id}:${target.id}`;
      const text = val(target, colId);
      return (
        <div style={{ marginTop: 3 }}>
          <button
            type="button" onClick={() => text && setOpenLink(openLink === key ? null : key)}
            style={{ ...timingBadge('#0B7A75'), cursor: text ? 'pointer' : 'default', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}
          >
            Noticia: {target.label}{text ? (openLink === key ? ' ▴' : ' ▾') : ''}
          </button>
          {openLink === key && text && (
            <div style={{ fontSize: 11.5, color: D.textPrimary, background: '#0B7A750D', borderRadius: 6, padding: '6px 8px', marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {text}
            </div>
          )}
        </div>
      );
    }
    const song = setListRows.find((r) => r.id === link.rowId);
    if (!song) return null;
    return (
      <div style={{ marginTop: 3 }}>
        <span style={{ ...timingBadge('#6554C0'), textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>Canción: {songText(song, colId)}</span>
      </div>
    );
  };

  const renderMoment = (m: ParsedMoment, child: boolean, last: boolean) => {
    const k = kindInfo(m.value.tipo);
    const dur = durationMinutes(m.value);
    const main = !child && !!m.value.tipo && m.value.tipo !== 'momento' && m.value.tipo !== 'transicion';
    const isCurrent = m.row.id === currentId, isNext = m.row.id === nextId;
    const detail = [m.value.responsable, m.value.nota].filter(Boolean).join(' · ');
    return (
      <div key={m.row.id} data-timing-row={m.row.id} style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: last ? 'none' : `0.5px solid ${D.divider}`,
        background: isCurrent ? '#1D9E7514' : undefined, borderRadius: isCurrent ? 6 : 0,
      }}>
        <div style={{
          width: child ? 106 : 92, flexShrink: 0, padding: '8px 10px 8px 0', textAlign: 'right',
          fontSize: child ? 11 : 12, fontVariantNumeric: 'tabular-nums', fontWeight: main ? 700 : 500,
          color: m.value.inicio ? (main ? D.textPrimary : D.textSecond) : D.textMuted, whiteSpace: 'nowrap',
        }}>
          {formatRange(m.value) || '—'}
        </div>
        <div style={{ width: 3, flexShrink: 0, borderRadius: 2, background: k.color, opacity: child ? 0.45 : 0.9, margin: '6px 10px 6px 0' }} />
        <div style={{ flex: 1, minWidth: 0, padding: '7px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: child ? 11.5 : 12, fontWeight: main ? 600 : 400, color: main ? D.textPrimary : D.textSecond }}>{m.label}</span>
            {m.value.tipo && m.value.tipo !== 'momento' && !child && <span style={timingBadge(k.color)}>{k.label}</span>}
            {dur != null && <span style={{ fontSize: 10.5, color: D.textMuted }}>{dur} min</span>}
            {isCurrent && <span style={timingBadge('#1D9E75')}>Ahora</span>}
            {isNext && <span style={timingBadge(D.textSecond)}>Próximo</span>}
          </div>
          {detail && <div style={{ fontSize: 11, color: D.textSecond, marginTop: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail}</div>}
          {linkChip(m)}
        </div>
      </div>
    );
  };

  // Comparación entre encuentros: mismo momento, horario y duración en cada uno.
  const canCompare = encuentros.length > 1;
  const compareTable = () => {
    const momentRows = tree.map((n) => ({
      label: n.label,
      cells: encuentros.map((e) => parseMoment(n.row, e.id).value),
    }));
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 6px', color: D.textMuted, fontWeight: 600 }}>Momento</th>
              {encuentros.map((e) => (
                <th key={e.id} style={{ textAlign: 'left', padding: '4px 6px', color: e.id === colId ? D.textPrimary : D.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {e.time || e.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {momentRows.map((r, i) => {
              const durations = r.cells.map((c) => (hasContent(c) ? durationMinutes(c) : 'vacío'));
              const differs = new Set(durations.map(String)).size > 1;
              return (
                <tr key={i} style={{ borderTop: `0.5px solid ${D.divider}` }}>
                  <td style={{ padding: '5px 6px', color: D.textPrimary, fontWeight: 600 }}>
                    {r.label}
                    {differs && <span style={{ ...timingBadge('#D4890A'), marginLeft: 6 }}>Distinto</span>}
                  </td>
                  {r.cells.map((c, j) => {
                    const d = durationMinutes(c);
                    return (
                      <td key={j} style={{
                        padding: '5px 6px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                        color: hasContent(c) ? D.textSecond : D.textMuted,
                        background: differs ? '#D4890A0F' : undefined,
                      }}>
                        {formatRange(c) || '—'}{d != null ? ` · ${d} min` : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="ficha-card" style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={S.cardTitle}>Timing</div>
        {canCompare && (
          <button
            type="button" className="ficha-no-print" onClick={() => setComparing((c) => !c)}
            style={{ fontSize: 11, fontWeight: 600, color: '#4338CA', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}
          >
            {comparing ? 'Ver timing' : 'Comparar encuentros'}
          </button>
        )}
      </div>
      {comparing && canCompare ? compareTable() : tree.map((n, i) => (
        <React.Fragment key={n.row.id}>
          {renderMoment(n, false, i === tree.length - 1 && n.children.length === 0)}
          {n.children.length > 0 && (
            <div style={{ marginLeft: 14, borderLeft: `1px dashed ${D.divider}`, paddingLeft: 4 }}>
              {n.children.map((c, j) => renderMoment(c, true, i === tree.length - 1 && j === n.children.length - 1))}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── AnunciosCard ──────────────────────────────────────────────────────────────

function AnunciosCard({
  rows, colId, timingRows = [],
  editable, forceShowAll, onCellChange, onDeleteRow, onAddRow, onLabelChange, onReorderRow, isCompleted, onComplete,
}: { rows: Row[]; timingRows?: Row[] } & EditProps) {
  const displayed = (editable || forceShowAll) ? allRows(rows) : rowsWithVal(rows, colId);
  // Momentos del timing que leen cada noticia.
  const inTiming = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of timingRows) {
      const p = parseMoment(r, colId);
      if (p.value.enlace?.seccion !== 'anuncios') continue;
      const list = map.get(p.value.enlace.rowId) ?? [];
      list.push([p.value.inicio, p.label].filter(Boolean).join(' '));
      map.set(p.value.enlace.rowId, list);
    }
    return map;
  }, [timingRows, colId]);
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
                        flex: 1, minWidth: 0,
                        fontSize: 12, color: content ? D.textPrimary : D.textMuted,
                        lineHeight: 1.45, whiteSpace: 'pre-wrap' as const,
                        wordBreak: 'break-word' as const,
                        overflowWrap: 'anywhere' as const,
                      }}>
                        {content || '—'}
                      </span>
                    )}
                    {inTiming.get(row.id) && (
                      <span title="Momento del timing que lee esta noticia" style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: '#0B7A75', maxWidth: '45%', textAlign: 'right' as const }}>
                        En el timing: {inTiming.get(row.id)!.join(', ')}
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
  encuentros, selected, onChange, showLayoutTab, showCompareTab,
}: { encuentros: Encuentro[]; selected: string; onChange: (id: string) => void; showLayoutTab?: boolean; showCompareTab?: boolean }) {
  const hasMultipleEncuentros = encuentros.length > 1;
  // Cuando showLayoutTab está activo, SIEMPRE mostramos al menos una píldora
  // de encuentro (aunque haya solo uno) para que el usuario pueda volver
  // a la vista principal desde Layout Visual sin salir de la ficha.
  const showEncuentroPills = hasMultipleEncuentros || (!!showLayoutTab && encuentros.length >= 1);
  if (!showEncuentroPills && !showLayoutTab) return null;

  const LAYOUT_COLOR = '#0D9488'; // teal — mismo que HubCard y catálogo

  // Label para la píldora del único encuentro: si viene con label propio, se
  // usa tal cual; si no, "Ficha" es más natural para el toggle de vuelta.
  function pillLabel(e: Encuentro): string {
    if (hasMultipleEncuentros) return e.label;
    return e.label && e.label.trim() ? e.label : 'Ficha';
  }

  return (
    <div className="ficha-no-print" style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      {showEncuentroPills && encuentros.map((e) => (
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
          {pillLabel(e)}
        </button>
      ))}

      {showCompareTab && (
        <button
          onClick={() => onChange('compare')}
          title="Ver todos los encuentros lado a lado"
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
            ...(selected === 'compare'
              ? { background: '#4338CA', color: '#fff', borderColor: '#4338CA' }
              : { background: '#4338CA12', color: '#4338CA', borderColor: '#4338CA55' }),
          }}
        >
          Comparar
        </button>
      )}

      {showLayoutTab && (
        <>
          {showEncuentroPills && (
            <div style={{ width: 1, height: 20, background: D.cardBorder, margin: '0 4px' }} />
          )}
          <button
            onClick={() => onChange('layout')}
            title="Ver / editar layout visual (iluminación + visuales por canción)"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
              ...(selected === 'layout'
                ? { background: LAYOUT_COLOR, color: '#fff', borderColor: LAYOUT_COLOR }
                : { background: `${LAYOUT_COLOR}12`, color: LAYOUT_COLOR, borderColor: `${LAYOUT_COLOR}55` }),
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Layout Visual
          </button>
        </>
      )}
    </div>
  );
}

// ── Layout de secciones (reordenable por botones ▲▼⇄, sin drag) ───────────────

type LayoutSlot = 'pastoral' | 'produccion' | 'media' | 'streaming' | 'horarios' | 'worship' | 'voluntarios' | 'anuncios';

// Orden pedido por Producción: primero el timing (qué sucederá y cuándo),
// luego responsables y equipos, después noticias y contenidos.
const DEFAULT_LAYOUT: { left: LayoutSlot[]; right: LayoutSlot[] } = {
  left:  ['horarios', 'pastoral', 'produccion', 'streaming'],
  right: ['worship', 'media', 'voluntarios', 'anuncios'],
};
const DEFAULT_LAYOUT_ORACION: { left: LayoutSlot[]; right: LayoutSlot[] } = {
  left:  ['horarios', 'pastoral', 'produccion', 'streaming'],
  right: ['worship', 'media'],
};

function slotLabel(slot: LayoutSlot): string {
  if (slot === 'worship') return 'AR Worship / Banda';
  if (slot === 'media')   return 'Media';
  return SECTION_LABELS[slot as SectionName] ?? slot;
}

/** Secciones que agrupa un slot — 'worship' junta 3 (escena+setList+outfit)
 *  porque siempre se renderizan como una sola card en una sola posición; el
 *  resto mapea 1:1 con su SectionName. */
function slotSectionNames(slot: LayoutSlot): SectionName[] {
  if (slot === 'worship') return ['escena', 'setList', 'outfit'];
  return [slot as SectionName];
}

/** Resuelve el layout guardado contra el default del tipo de ficha. 'media'
 *  siempre debe estar presente en algún lado (legacy: fichas creadas antes
 *  de que 'media' existiera como slot no lo tienen guardado). */
function resolveSectionLayout(
  fichaType: string,
  sectionLayoutProp?: { left: string[]; right: string[]; leftRatio?: number },
): { left: LayoutSlot[]; right: LayoutSlot[]; leftRatio: number } {
  const defaultLayout = fichaType === 'oracion' ? DEFAULT_LAYOUT_ORACION : DEFAULT_LAYOUT;
  const storedLayout = (sectionLayoutProp ?? defaultLayout) as { left: LayoutSlot[]; right: LayoutSlot[]; leftRatio?: number };
  const layoutHasMedia = [...storedLayout.left, ...storedLayout.right].includes('media');
  return {
    left:  layoutHasMedia ? storedLayout.left  : [...storedLayout.left],
    right: layoutHasMedia ? storedLayout.right : [...storedLayout.right, 'media'],
    leftRatio: Math.min(0.8, Math.max(0.2, storedLayout.leftRatio ?? 0.5)),
  };
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
  onReorderRow?: (section: SectionName, activeId: string, overId: string) => void;
  onRowPatch?: (section: SectionName, rowId: string, patch: Partial<Row>) => void;
  onSectionComplete?: (section: SectionName) => void;
  sectionStatus?: Partial<Record<SectionName, boolean>>;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  hiddenSections?: SectionName[];
  /** Estado (controlado por el padre) de si el panel de edición de módulos
   *  está abierto — cuando lo está, el padre reemplaza el side panel de
   *  Equipo por <ModulesEditPanel/> en su lugar. */
  modulesPanelOpen?: boolean;
  onToggleModulesPanel?: () => void;
  sectionLayout?: { left: string[]; right: string[]; leftRatio?: number };
  onUpdateLayout?: (layout: { left: string[]; right: string[]; leftRatio?: number }) => void;
  /** Persistir el bloque layoutVisual completo (vista alternativa por canción). */
  onUpdateLayoutVisual?: (patch: { slots: LayoutVisualSlot[] }) => void;
  /** Mostrar el historial de cambios en la primera vista (requiere sesión). */
  showHistory?: boolean;
  /** Guardar la lista de encuentros (agregar, quitar, cambiar hora). */
  onUpdateEncuentros?: (list: EncuentroDraft[]) => Promise<void>;
}

export function FichaDocumentView({
  ficha, onEdit, onSave, onArchive, onUnarchive, canArchive,
  onPublish, onUnpublish, canPublish, isPublishing,
  editable, forceShowAll, localSections, onCellChange, onAddRow, onDeleteRow, onLabelChange, onReorderRow, onRowPatch, onSectionComplete,
  sectionStatus, saveState, hiddenSections, modulesPanelOpen, onToggleModulesPanel,
  sectionLayout: sectionLayoutProp, onUpdateLayout, onUpdateLayoutVisual, showHistory, onUpdateEncuentros,
}: FichaDocumentViewProps) {
  const { sections, encuentros, campusName, title, date } = ficha;
  const { data: changelog, refetch: refetchChangelog } = useChangelog(showHistory ? String(ficha.fichaId) : '');
  useEffect(() => { if (showHistory) void refetchChangelog(); }, [showHistory, ficha.lastModifiedAt, refetchChangelog]);

  // selectedId puede ser el id de un encuentro ('unico', 'e1', 'e2', ...) o
  // el sentinel 'layout' para la vista alternativa de Layout Visual.
  const [selectedId, setSelectedId] = useState<string>(
    encuentros?.[0]?.id ?? 'unico',
  );

  const isLayoutView = selectedId === 'layout';
  const isCompareView = selectedId === 'compare';
  const [encuentrosOpen, setEncuentrosOpen] = useState(false);
  // Si se quita el encuentro abierto (o queda uno solo), volver al primero.
  useEffect(() => {
    const list = encuentros ?? [];
    const first = list[0]?.id ?? 'unico';
    if (selectedId === 'layout') return;
    if (selectedId === 'compare' ? list.length < 2 : !list.some((e) => e.id === selectedId)) setSelectedId(first);
  }, [encuentros, selectedId]);
  const selectedEncuentro = encuentros?.find((e) => e.id === selectedId) ?? null;
  // Cuando estamos en Layout Visual, usamos el primer encuentro como fallback
  // para colId (necesario porque las cards internas siguen recibiendo colId).
  const colId = isLayoutView || isCompareView ? (encuentros?.[0]?.id ?? 'unico') : selectedId;

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
    onRowPatch:    onRowPatch    ? (rowId, patch) => onRowPatch(name, rowId, patch)                   : undefined,
    isCompleted:   sectionStatus?.[name] ?? sections?.[name]?.isCompleted,
    onComplete:    onSectionComplete ? () => onSectionComplete(name)                                  : undefined,
  });

  const [copied,           setCopied]           = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const isPublished = ficha.published ?? false;
  const docRef     = useRef<HTMLDivElement>(null);
  const bodyRef    = useRef<HTMLDivElement>(null);       // vista clásica (encuentro)
  const layoutRef  = useRef<HTMLDivElement>(null);       // vista Layout Visual

  const hidden = (n: SectionName) => (hiddenSections ?? []).includes(n);

  // Layout de secciones (solo lectura acá — la edición vive en <ModulesEditPanel/>)
  const resolvedLayout = resolveSectionLayout(ficha.type, sectionLayoutProp ?? ficha.sectionLayout);

  const { paletas, loading: paletasLoading } = usePaletas();

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
    const newDate = new Date(y, mo - 1, d, 12, 0, 0);
    const localNoon = newDate.toISOString();

    // El título se auto-genera al crear la ficha con el patrón fijo
    // "Tipo · fecha corta · hora" (ej. "Encuentro Presencial · 19 sept ·
    // 17:30"), pero después queda como texto libre desconectado de `date`.
    // En vez de buscar el texto exacto de la fecha anterior (frágil: el
    // formato de Intl puede diferir sutilmente entre el momento en que se
    // generó y ahora), reemplazamos estructuralmente el segmento del medio
    // cuando el título todavía tiene esos 3 segmentos separados por " · ".
    // Si el título fue editado a mano y ya no calza esa estructura, no lo
    // tocamos.
    const newLabel = newDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    const titleParts = title.split(' · ');
    let nextTitle: string | undefined;
    if (titleParts.length === 3) {
      titleParts[1] = newLabel;
      nextTitle = titleParts.join(' · ');
    }

    updateFicha({
      fichaId: String(ficha.fichaId),
      date: localNoon,
      ...(nextTitle !== undefined ? { title: nextTitle } : {}),
    });
    if (nextTitle !== undefined) setLocalTitle(nextTitle);
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
      style={{ maxWidth: 980, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* ── Estilos globales y de impresión ── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Ficha angosta (tablet, notebook chica o panel lateral abierto): las
           secciones pasan a una columna, primero la izquierda y luego la
           derecha. Depende del ancho de la ficha, no de la pantalla; en A4 la
           ficha mide más de 680px y conserva las dos columnas. */
        .ficha-doc { container-type: inline-size; color: ${D.textPrimary}; color-scheme: light; }
        .ficha-doc-root { --song-primary: ${D.textPrimary}; --song-secondary: ${D.textSecond}; --song-muted: ${D.textMuted}; --song-border: ${D.inputBorder}; --song-surface: #fff; }
        .ficha-hdr .ficha-logo { filter: brightness(0); opacity: 0.86; }
        .ficha-drag-handle, .ficha-block-handle {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; border: 1px solid transparent; border-radius: 6px;
          color: #74819A; background: #F4F6FA; cursor: grab; touch-action: none;
          padding: 5px 2px;
        }
        .ficha-drag-handle:active, .ficha-block-handle:active { cursor: grabbing; }
        .ficha-drag-handle:hover, .ficha-block-handle:hover { color: #6554C0; background: #EEEAFB; }
        .ficha-block-handle { position: absolute; top: 9px; right: 12px; gap: 4px; padding: 4px 6px; font-size: 10px; font-weight: 600; }
        .ficha-sortable-block > .ficha-card > div:first-child { padding-right: 100px; min-height: 21px; }
        .ficha-sortable-block.is-over { outline: 2px solid #A99CE7; border-radius: 12px; }
        .ficha-drop-column { min-width: 0; min-height: 90px; border-radius: 12px; }
        .ficha-drop-column.is-over { background: #EEEAFB; }
        .ficha-drop-end { border: 1px dashed #CCD4E1; color: #69768B; border-radius: 10px; padding: 12px; text-align: center; font-size: 11px; }
        .ficha-positions > .ficha-sortable-row { flex: 1 1 105px; display: flex; }
        .ficha-sortable-row:hover { background: #F8F9FC; border-radius: 6px; }
        .ficha-doc .ficha-cell-input { border-radius: 4px; transition: background 0.15s; }
        .ficha-doc .ficha-cell-input:focus { background: #F0EDFC !important; border-bottom-color: #6554C0 !important; }
        .ficha-doc button:focus-visible { outline: 2px solid #6554C0; outline-offset: 3px; }
        .ficha-add-row { background: #F0EDFC !important; color: #6554C0 !important; border: 1px solid #DED7F5 !important; padding: 7px 10px !important; border-radius: 7px; font-weight: 600; }
        .ficha-editor-help { display: flex; gap: 8px; align-items: center; margin: 0 0 18px; padding: 10px 12px; border: 1px solid #DFE5EF; border-radius: 9px; background: #EDF1F7; color: #526078; font-size: 12px; }
        .ficha-hdr-top { gap: 16px; }
        .ficha-title-area { min-width: 0; }
        .ficha-action-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          padding: 8px;
          border: 1px solid #E2E6EE;
          border-radius: 12px;
          background: #F7F8FB;
        }
        .ficha-action-bar button { min-height: 34px; }
        .ficha-publication-state {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 34px;
          padding: 0 9px;
          border-radius: 8px;
          color: #087F5B;
          background: rgba(29,158,117,0.1);
          border: 1px solid rgba(29,158,117,0.23);
          font-size: 11px;
          font-weight: 700;
        }
        .ficha-publication-state::before { content: ''; width: 6px; height: 6px; border-radius: 99px; background: #1D9E75; }
        @container (max-width: 530px) {
          .ficha-hdr-top { align-items: flex-start !important; padding: 18px 18px 14px !important; }
          .ficha-hdr-top .ficha-logo { height: 31px !important; }
          .ficha-hdr > div:last-child { padding: 14px 18px 18px !important; }
          .ficha-title-text { font-size: 19px !important; }
          .ficha-action-bar { padding: 6px; }
        }
        @container (max-width: 680px) {
          .ficha-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }

        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }

        @media print {
          /* Conservar los acentos, con papel claro para una lectura cómoda. */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            background: white !important;
          }

          /* Ocultar controles */
          .ficha-no-print { display: none !important; }

          /* Contenedor raíz */
          .ficha-doc-root { max-width: 100% !important; margin: 0 !important; }

          /* Wrapper del documento sin borde/radius, ocupa el ancho de página */
          .ficha-doc {
            background: white !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          /* Ambas vistas visibles en print (en pantalla, la inactiva está
             display:none via inline style). page-break-before pone el
             layout en la segunda página. */
          .ficha-view-hidden { display: block !important; }
          .ficha-view-active { display: block !important; }

          .layout-visual-page {
            page-break-before: always !important;
            break-before: page !important;
          }
          .layout-visual-page.layout-visual-empty {
            display: none !important;
            page-break-before: auto !important;
            break-before: auto !important;
          }
          /* Multi-encuentro: cada slot (AM/PM) siempre visible en print
             y cada slot posterior al primero arranca en su propia hoja. */
          .layout-slot { display: block !important; }
          .layout-slot-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Muestra versión estática de swatches/thumbs */
          .ficha-print-only { display: flex !important; }

          /* ── Compactación para que la ficha quepa en 1 hoja A4 ──
             Solo se reduce padding/margen/tamaño de fuente — los colores
             del tema oscuro NO se tocan (siguen como en pantalla). */

          /* Header: menos padding, logo más chico, fuente reducida */
          .ficha-hdr-top {
            padding: 8px 14px !important;
          }
          .ficha-hdr-top img { height: 26px !important; }
          .ficha-hdr > div:last-child {
            padding: 6px 14px 8px !important;
          }
          .ficha-hdr > div:last-child div[style*="fontSize: 22"],
          .ficha-hdr h1 {
            font-size: 14px !important;
          }

          /* Cuerpo: padding compacto */
          .ficha-body { padding: 8px 12px !important; }

          /* Grilla: gap chico */
          .ficha-grid { gap: 6px !important; }

          /* Cards: padding reducido, no se cortan entre páginas */
          .ficha-card {
            padding: 6px 9px !important;
            margin-bottom: 6px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Título de cada card más chico */
          .ficha-card > div:first-child {
            font-size: 8px !important;
            margin-bottom: 4px !important;
          }

          /* Filas de roles: menos padding vertical */
          .ficha-card div[style*="padding: 6px"] {
            padding: 2px 0 !important;
          }

          /* Reducir font-size global del documento (los valores en px de
             inline styles no se ven afectados, así que también compactamos
             elementos específicos). */
          .ficha-doc { font-size: 10px !important; }
        }
      `}</style>

      <EncuentroTabs
        encuentros={encuentros ?? []}
        selected={selectedId}
        onChange={setSelectedId}
        showLayoutTab
        showCompareTab={(encuentros?.length ?? 0) > 1}
      />

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
        ref={docRef}
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
              src="/logo.png"
              alt="ARM Global"
              className="ficha-logo"
              style={{ height: 40, width: 'auto', objectFit: 'contain', display: 'block', maxWidth: '40%' }}
            />
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
                    colorScheme: 'light',
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => editable && setEditingDate(true)}
                  title={editable ? 'Clic para editar fecha' : undefined}
                  aria-label={editable ? 'Editar fecha de la ficha' : undefined}
                  style={{
                    fontSize: 15, fontWeight: 600, color: D.textPrimary,
                    cursor: editable ? 'text' : 'default',
                    borderRadius: 6, padding: '2px 6px',
                    border: editable ? '1px solid transparent' : 'none', background: 'transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                    display: 'inline-block',
                  }}
                  onMouseEnter={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                >
                  {formatDate(localDate || date)}
                </button>
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
            <div className="ficha-title-area" style={{ minWidth: 0 }}>
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
                <button
                  type="button"
                  className="ficha-title-text"
                  onClick={() => editable && setEditingTitle(true)}
                  title={editable ? 'Clic para editar título' : undefined}
                  aria-label={editable ? 'Editar título de la ficha' : undefined}
                  style={{
                    fontSize: 22, fontWeight: 700, color: D.textPrimary, letterSpacing: '-0.01em',
                    cursor: editable ? 'text' : 'default',
                    borderRadius: 6,
                    padding: '2px 4px',
                    marginLeft: -4,
                    border: editable ? '1px solid transparent' : 'none', background: 'transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                    lineHeight: 1.25, textAlign: 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                  }}
                  onMouseEnter={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={(e) => { if (editable) (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                >
                  {localTitle}
                </button>
              )}
            </div>

            {/* ── Botones de acción (ocultos en impresión) ── */}
            <div className="ficha-no-print ficha-action-bar">

              {isPublished && <span className="ficha-publication-state">En línea</span>}

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
                    background: isSaveError ? '#FEF2F2' : isSaved ? C.green : C.purple,
                    color: isSaveError ? '#B91C1C' : '#FFFFFF',
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

              {/* Módulos (solo modo edición) — el panel de edición vive en el
                  side panel del padre (<ModulesEditPanel/>), no acá, para que
                  reemplace la lista de Equipo mientras se editan módulos. */}
              {editable && onToggleModulesPanel && (
                <button
                  onClick={onToggleModulesPanel}
                  title="Gestionar módulos"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: modulesPanelOpen ? 'rgba(127,119,221,0.15)' : 'rgba(255,255,255,0.06)',
                    color: modulesPanelOpen ? C.purple : D.textSecond,
                    border: `0.5px solid ${modulesPanelOpen ? 'rgba(127,119,221,0.35)' : D.cardBorder}`,
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
              )}

              {editable && onUpdateEncuentros && (
                <button
                  onClick={() => setEncuentrosOpen(true)}
                  title="Agregar, quitar o cambiar la hora de los encuentros"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'rgba(255,255,255,0.06)', color: D.textSecond,
                    border: `0.5px solid ${D.cardBorder}`, cursor: 'pointer',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
                  </svg>
                  Encuentros ({encuentros?.length ?? 0})
                </button>
              )}
              {encuentrosOpen && onUpdateEncuentros && (
                <EncuentrosEditor
                  encuentros={encuentros ?? []}
                  type={ficha.type}
                  onSave={onUpdateEncuentros}
                  onClose={() => setEncuentrosOpen(false)}
                />
              )}

              {/* Descargar PDF */}
              <button
                onClick={() => window.print()}
                title='Descargar PDF (elegí "Guardar como PDF" en el diálogo)'
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', color: D.textSecond,
                  border: `0.5px solid ${D.cardBorder}`, cursor: 'pointer',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Imprimir / PDF
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
                  {isPublished ? 'Gestionar' : 'Publicar'}
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

        {/* ── Primera vista: lo esencial en 15 segundos ── */}
        {!isLayoutView && !isCompareView && (
          <FichaQuickView
            ficha={ficha}
            rowsFor={sec}
            colId={colId}
            encuentro={selectedEncuentro}
            hiddenSections={hiddenSections ?? ficha.hiddenSections ?? []}
            changes={showHistory ? changelog : undefined}
            onOpenLayout={() => setSelectedId('layout')}
            onJump={(slot) => document.querySelector(`[data-ficha-slot="${slot}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        )}

        {isCompareView && (
          <FichaCompareView
            encuentros={encuentros ?? []}
            sections={(SECTIONS_BY_TYPE[ficha.type] ?? SECTIONS_BY_TYPE.multi).filter((n) => !hidden(n))}
            rowsFor={sec}
            paletteName={(id) => paletas.find((p) => p.id === id)?.name}
            onRowPatch={editable ? onRowPatch : undefined}
          />
        )}

        {/* ── Cuerpo (vista clásica por encuentro) ──
            Va PRIMERO en el DOM para que en print salga como página 1.
            El Layout Visual viene después con page-break-before: always. */}
        <div
          ref={bodyRef}
          className={`ficha-body ficha-view-body ${isLayoutView ? 'ficha-view-hidden' : 'ficha-view-active'}`}
          style={{ padding: '1.5rem 2rem', display: isLayoutView || isCompareView ? 'none' : 'block' }}
        >
          {editable && (
            <div className="ficha-editor-help ficha-no-print">
              <span aria-hidden="true">⠿</span>
              <span>Arrastra las asas para ordenar filas o mover bloques entre columnas. Los cambios se guardan automáticamente.</span>
            </div>
          )}
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
                  return !hidden('horarios') ? (
                    <TimingCard
                      key="horarios" rows={sec('horarios')} {...editProps('horarios')}
                      encuentros={encuentros ?? []} anunciosRows={sec('anuncios')} setListRows={sec('setList')} fichaDate={date}
                    />
                  ) : null;
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
                  return !hidden('anuncios') ? <AnunciosCard key="anuncios" rows={sec('anuncios')} timingRows={sec('horarios')} {...editProps('anuncios')} /> : null;
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

            // Filtramos ocultos ANTES del map para no renderear cards vacías.
            const visibleLeft  = resolvedLayout.left.filter((s) => !slotIsHidden(s));
            const visibleRight = resolvedLayout.right.filter((s) => !slotIsHidden(s));

            return (
              <SortableFichaLayout
                layout={resolvedLayout}
                visible={{ left: visibleLeft, right: visibleRight }}
                onChange={editable ? onUpdateLayout : undefined}
                renderSlot={(slot) => <div data-ficha-slot={slot} style={{ scrollMarginTop: 72 }}>{renderSlot(slot as LayoutSlot)}</div>}
                label={(slot) => slotLabel(slot as LayoutSlot)}
              />
            );
          })()}
        </div>

        {/* ── Vista alternativa: Layout Visual ──
            Se renderiza SIEMPRE en el DOM. En pantalla, visible solo cuando
            la píldora "Layout Visual" está activa (display: none en la otra).
            En print, ambas vistas quedan visibles y el CSS @media print
            aplica page-break-before al layout-visual-page para que salga
            como segunda página — EXCEPTO cuando el layout está vacío
            (layout-visual-empty), en cuyo caso se oculta para no dejar
            página en blanco al imprimir. */}
        {(() => {
          // Detecta si el layout tiene contenido en cualquiera de sus slots
          // (nueva forma con slots[]) o en la forma legacy (songs a nivel raíz).
          const slots = ficha.layoutVisual?.slots ?? [];
          const legacySongs = ficha.layoutVisual?.songs ?? [];
          const legacyNotes = ficha.layoutVisual?.producerNotes ?? '';
          const songHasContent = (s: any) =>
            (s.iluminacion?.trim()?.length ?? 0) > 0 ||
            (s.illuminationColors?.length ?? 0) > 0 ||
            (s.visualDescription?.trim()?.length ?? 0) > 0 ||
            (s.referenceIds?.length ?? 0) > 0;
          const hasSlotContent = slots.some((sl) =>
            (sl.songs ?? []).some(songHasContent)
            || (sl.producerNotes?.trim()?.length ?? 0) > 0,
          );
          const hasLegacyContent =
            legacySongs.some(songHasContent)
            || (legacyNotes.trim().length > 0);
          const hasLayoutContent = hasSlotContent || hasLegacyContent;
          return (
            <div
              ref={layoutRef}
              className={`layout-visual-page ${isLayoutView ? 'ficha-view-active' : 'ficha-view-hidden'} ${hasLayoutContent ? '' : 'layout-visual-empty'}`}
              style={{ display: isLayoutView ? 'block' : 'none' }}
            >
              <LayoutVisualView
                ficha={ficha}
                editable={!!editable && !!onUpdateLayoutVisual}
                localSetListRows={editable ? localSections?.setList : undefined}
                onSave={onUpdateLayoutVisual}
              />
            </div>
          );
        })()}

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

// ── ModulesEditPanel ──────────────────────────────────────────────────────────
// Panel de edición de módulos (visibilidad + orden). Vive en el side panel del
// editor (reemplazando la lista de Equipo mientras está abierto) en vez de un
// dropdown flotante — así no queda recortado por el `overflow:hidden` de la
// tarjeta del documento ni desaparece al hacer click fuera por accidente.

const moveBtnClass =
  'w-[18px] h-[18px] flex items-center justify-center text-[9px] rounded border border-gray-200 bg-white text-gray-500 flex-shrink-0 disabled:opacity-30 disabled:cursor-default';

export interface ModulesEditPanelProps {
  fichaType:       string;
  hiddenSections?: SectionName[];
  /** Acepta un nombre o varios (el slot 'worship' agrupa 3 secciones que se
   *  togglean juntas, como una sola fila en la lista). */
  onToggleModule:  (name: SectionName | SectionName[]) => void;
  sectionLayout?:  { left: string[]; right: string[]; leftRatio?: number };
  onUpdateLayout:  (layout: { left: string[]; right: string[]; leftRatio?: number }) => void;
  onClose:         () => void;
}

export function ModulesEditPanel({
  fichaType, hiddenSections, onToggleModule, sectionLayout, onUpdateLayout, onClose,
}: ModulesEditPanelProps) {
  const hidden = (n: SectionName) => (hiddenSections ?? []).includes(n);
  const resolvedLayout = resolveSectionLayout(fichaType, sectionLayout);

  // Mismo reordenamiento por botones ▲▼⇄ que el resto de la ficha — ver
  // comentario al inicio del archivo sobre por qué no es drag-and-drop.
  function moveSlot(column: 'left' | 'right', index: number, direction: -1 | 1) {
    const source = [...resolvedLayout[column]];
    const target = index + direction;
    if (target < 0 || target >= source.length) return;
    [source[index], source[target]] = [source[target], source[index]];
    onUpdateLayout({
      left:  column === 'left'  ? source : resolvedLayout.left,
      right: column === 'right' ? source : resolvedLayout.right,
      leftRatio: resolvedLayout.leftRatio,
    });
  }

  function moveSlotAcross(column: 'left' | 'right', index: number) {
    const fromArr = [...resolvedLayout[column]];
    const toArr   = [...resolvedLayout[column === 'left' ? 'right' : 'left']];
    const [slot]  = fromArr.splice(index, 1);
    toArr.push(slot);
    onUpdateLayout({
      left:  column === 'left' ? fromArr : toArr,
      right: column === 'left' ? toArr   : fromArr,
      leftRatio: resolvedLayout.leftRatio,
    });
  }

  return (
    <div className="card flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <p className="text-xs font-semibold text-gray-900">Módulos</p>
        <button
          onClick={onClose}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-md"
          style={{ background: 'rgba(29,158,117,0.12)', color: C.green }}
        >
          Listo
        </button>
      </div>

      <div className="grid gap-3 px-4 py-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-1">
        {(['left', 'right'] as const).map((column) => (
          <div key={column}>
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">
              {column === 'left' ? 'Columna izquierda' : 'Columna derecha'}
            </p>
            <div className="flex flex-col gap-1">
              {resolvedLayout[column].map((slot, i) => {
                const names = slotSectionNames(slot);
                const isHidden = names.every((n) => hidden(n));
                return (
                  <div key={slot} className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-gray-50 border border-gray-100">
                    <button
                      onClick={() => onToggleModule(names.length > 1 ? names : names[0])}
                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    >
                      <span
                        className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
                        style={{
                          background: isHidden ? '#F3F4F6' : 'rgba(29,158,117,0.12)',
                          border: `1px solid ${isHidden ? '#E5E7EB' : 'rgba(29,158,117,0.4)'}`,
                        }}
                      >
                        {!isHidden && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                            stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-[11px] truncate ${isHidden ? 'text-gray-400' : 'text-gray-700'}`}>
                        {slotLabel(slot)}
                      </span>
                    </button>
                    <button
                      onClick={() => moveSlot(column, i, -1)}
                      disabled={i === 0}
                      title="Subir"
                      className={moveBtnClass}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveSlot(column, i, 1)}
                      disabled={i === resolvedLayout[column].length - 1}
                      title="Bajar"
                      className={moveBtnClass}
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => moveSlotAcross(column, i)}
                      title={column === 'left' ? 'Mover a columna derecha' : 'Mover a columna izquierda'}
                      className={moveBtnClass}
                    >
                      {column === 'left' ? '→' : '←'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
