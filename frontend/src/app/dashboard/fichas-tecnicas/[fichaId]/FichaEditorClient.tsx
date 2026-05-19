'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useFichaRealtime, useUpdateSection, useCompleteSection } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { SECTION_LABELS, statusColor, statusLabel } from '@/types/ficha';
import { SongInput } from '@/components/fichas/SongInput';
import { FichaDocumentView } from './FichaDocumentView';
import type { FichaType, Section, Row, SectionName, Encuentro } from '@/types/ficha';

function getSectionLabel(name: SectionName, fichaType: FichaType): string {
  if (fichaType === 'oracion') {
    if (name === 'pastoral')  return 'Equipo Plataforma';
    if (name === 'escena')    return 'Equipo ARW';
    if (name === 'produccion') return 'Equipo Técnico';
    if (name === 'streaming') return 'Equipo Streaming';
    if (name === 'setList')   return 'Set List — Canciones';
    if (name === 'horarios')  return 'Flujo del Encuentro';
  }
  return SECTION_LABELS[name];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw: any): string {
  if (!raw) return '—';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000);
  return d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── SaveIndicator ─────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const configs: Record<SaveState, { text: string; color: string }> = {
    idle:   { text: '',                  color: '' },
    saving: { text: 'Guardando…',       color: '#9CA3AF' },
    saved:  { text: 'Guardado ✓',       color: '#1D9E75' },
    error:  { text: 'Error al guardar', color: '#EF4444' },
  };
  const { text, color } = configs[state];
  return (
    <span className="text-xs font-medium transition-all" style={{ color }}>
      {state === 'saving' && (
        <svg className="inline w-3 h-3 mr-1 animate-spin" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {text}
    </span>
  );
}

// ── SectionStatusBadge ────────────────────────────────────────────────────────

function SectionStatusBadge({ section }: { section: Section }) {
  if (section.isCompleted) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(29,158,117,0.12)', color: '#1D9E75' }}>
        ✓ Completada
      </span>
    );
  }
  const hasData = section.rows?.some((r) => Object.values(r.values ?? {}).some((v) => v?.trim()));
  if (hasData) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(127,119,221,0.12)', color: '#7F77DD' }}>
        En progreso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(0,0,0,0.05)', color: '#9CA3AF' }}>
      Pendiente
    </span>
  );
}

// ── RowEditor ─────────────────────────────────────────────────────────────────

interface RowEditorProps {
  row: Row;
  encuentros: Encuentro[];
  readOnly: boolean;
  canDelete: boolean;
  onChange: (rowId: string, colId: string, value: string) => void;
  onDelete: (rowId: string) => void;
}

function RowEditor({ row, encuentros, readOnly, canDelete, onChange, onDelete }: RowEditorProps) {
  const cols = row.shared
    ? [{ id: 'shared', label: '' }]
    : encuentros.map((e) => ({ id: e.id, label: e.label, color: e.color }));

  return (
    <div className="group flex items-start gap-2">
      <div className="flex-1 grid gap-y-0.5">
        {/* Label + col headers (only for multi-col non-shared rows) */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-gray-500 font-medium flex-1 min-w-0 truncate">
            {row.label}
            {row.required && <span className="text-red-400 ml-0.5">*</span>}
          </span>
        </div>

        {/* Input grid */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
        >
          {cols.map((col) => {
            const val = row.values?.[col.id] ?? '';
            return (
              <div key={col.id} className="flex flex-col gap-0.5">
                {col.label && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide truncate"
                    style={{ color: (col as any).color ?? '#6b7280' }}>
                    {col.label}
                  </span>
                )}
                {row.type === 'song' ? (
                  <SongInput
                    value={val}
                    readOnly={readOnly}
                    onChange={(v) => onChange(row.id, col.id, v)}
                  />
                ) : (
                  <input
                    type="text"
                    value={val}
                    readOnly={readOnly}
                    placeholder={row.type === 'person' ? 'Nombre…' : 'Ingresar…'}
                    onChange={(e) => onChange(row.id, col.id, e.target.value)}
                    className={`input text-xs py-1.5 ${readOnly ? 'bg-gray-50 cursor-default' : ''}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete button */}
      {canDelete && !readOnly && (
        <button
          type="button"
          onClick={() => onDelete(row.id)}
          className="mt-5 p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
          title="Eliminar fila"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── AddRowBar ─────────────────────────────────────────────────────────────────

interface AddRowBarProps {
  sectionName: SectionName;
  onAdd: (label: string, type: Row['type'], shared: boolean) => void;
}

function AddRowBar({ sectionName, onAdd }: AddRowBarProps) {
  const [open, setOpen]   = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType]   = useState<Row['type']>('person');
  const [shared, setShared] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default type per section
  useEffect(() => {
    if (sectionName === 'setList')        setType('song');
    else if (sectionName === 'horarios' || sectionName === 'anuncios') setType('text');
    else setType('person');
    // Default shared per section
    setShared(['produccion', 'streaming', 'escena', 'anuncios', 'voluntarios'].includes(sectionName));
  }, [sectionName]);

  function submit() {
    if (!label.trim()) return;
    onAdd(label.trim(), type, shared);
    setLabel('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors py-1 px-1"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Agregar fila
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap pt-1">
      <input
        ref={inputRef}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setOpen(false); setLabel(''); } }}
        placeholder="Nombre de la fila…"
        className="input text-xs py-1 flex-1 min-w-32"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as Row['type'])}
        className="input text-xs py-1 w-auto"
      >
        <option value="person">Persona</option>
        <option value="text">Texto</option>
        <option value="song">Canción</option>
      </select>
      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => setShared(e.target.checked)}
          className="rounded"
        />
        Compartido
      </label>
      <button type="button" onClick={submit}
        className="btn-primary text-xs py-1 px-3">
        Agregar
      </button>
      <button type="button" onClick={() => { setOpen(false); setLabel(''); }}
        className="text-xs text-gray-400 hover:text-gray-600">
        Cancelar
      </button>
    </div>
  );
}

// ── SectionPanel ──────────────────────────────────────────────────────────────

interface SectionPanelProps {
  fichaId: string;
  sectionName: SectionName;
  section: Section;
  encuentros: Encuentro[];
  canEdit: boolean;
  fichaType: FichaType;
  onSaveState: (state: SaveState) => void;
}

function SectionPanel({
  fichaId, sectionName, section, encuentros, canEdit, fichaType, onSaveState,
}: SectionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [localRows, setLocalRows] = useState<Row[]>(section.rows ?? []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutate: updateSection } = useUpdateSection();
  const { mutate: completeSection, isPending: completing } = useCompleteSection();

  // Sync when Firestore pushes a new snapshot
  useEffect(() => { setLocalRows(section.rows ?? []); }, [section.rows]);

  // ── Guardar con debounce ─────────────────────────────────────────────────
  const save = useCallback(
    (rows: Row[], immediate = false) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onSaveState('saving');
      const delay = immediate ? 0 : 800;
      debounceRef.current = setTimeout(() => {
        updateSection(
          { fichaId, sectionName, rows },
          {
            onSuccess: () => { onSaveState('saved'); setTimeout(() => onSaveState('idle'), 2000); },
            onError:   () => { onSaveState('error'); setTimeout(() => onSaveState('idle'), 3000); },
          },
        );
      }, delay);
    },
    [fichaId, sectionName, updateSection, onSaveState],
  );

  // ── Editar valor de una celda ────────────────────────────────────────────
  const handleChange = useCallback(
    (rowId: string, colId: string, value: string) => {
      const updated = localRows.map((r) =>
        r.id === rowId ? { ...r, values: { ...r.values, [colId]: value } } : r,
      );
      setLocalRows(updated);
      save(updated);
    },
    [localRows, save],
  );

  // ── Agregar fila ─────────────────────────────────────────────────────────
  const handleAddRow = useCallback(
    (label: string, type: Row['type'], shared: boolean) => {
      const newRow: Row = {
        id:       `custom_${uid()}`,
        label,
        type,
        shared,
        values:   {},
        order:    localRows.length,
        required: false,
      };
      const updated = [...localRows, newRow];
      setLocalRows(updated);
      save(updated, true);
    },
    [localRows, save],
  );

  // ── Eliminar fila ────────────────────────────────────────────────────────
  const handleDeleteRow = useCallback(
    (rowId: string) => {
      const updated = localRows.filter((r) => r.id !== rowId);
      setLocalRows(updated);
      save(updated, true);
    },
    [localRows, save],
  );

  // ── Marcar como completada ───────────────────────────────────────────────
  function handleComplete() {
    completeSection(
      { fichaId, sectionName },
      {
        onSuccess: () => { onSaveState('saved'); setTimeout(() => onSaveState('idle'), 2000); },
      },
    );
  }

  const sorted = [...localRows].sort((a, b) => a.order - b.order);

  return (
    <div className="card overflow-hidden">
      {/* Header ── clickeable para expand/collapse */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-gray-800">
            {getSectionLabel(sectionName, fichaType)}
          </span>
          <span className="text-[11px] text-gray-400">
            Responsable:{' '}
            <span className="font-medium text-gray-600">
              {section.assignedName ?? 'Sin asignar'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SectionStatusBadge section={section} />
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">

          {/* Cabeceras de columnas (para secciones multi-encuentro, no-shared) */}
          {encuentros.length > 1 && sorted.some((r) => !r.shared) && (
            <div className="hidden sm:flex gap-2 items-end pb-1">
              <div className="flex-1" /> {/* espacio label */}
              {encuentros.map((e) => (
                <div key={e.id} className="flex-1 text-[9px] font-bold uppercase tracking-wide truncate"
                  style={{ color: e.color }}>
                  {e.label}
                </div>
              ))}
            </div>
          )}

          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin filas configuradas</p>
          ) : (
            <div className="space-y-3">
              {sorted.map((row) => (
                <RowEditor
                  key={row.id}
                  row={row}
                  encuentros={encuentros}
                  readOnly={!canEdit || section.isCompleted}
                  canDelete={canEdit && !section.isCompleted}
                  onChange={handleChange}
                  onDelete={handleDeleteRow}
                />
              ))}
            </div>
          )}

          {/* Agregar fila */}
          {canEdit && !section.isCompleted && (
            <div className="pt-2 border-t border-dashed border-gray-200">
              <AddRowBar sectionName={sectionName} onAdd={handleAddRow} />
            </div>
          )}

          {/* Botón completar */}
          {canEdit && !section.isCompleted && (
            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleComplete}
                disabled={completing}
                className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-50"
              >
                {completing ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                Marcar como completada
              </button>
            </div>
          )}

          {section.isCompleted && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-center" style={{ color: '#1D9E75' }}>
                ✓ Sección completada
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Orden de secciones ────────────────────────────────────────────────────────

const SECTION_ORDER: SectionName[] = [
  'pastoral', 'escena', 'produccion', 'streaming',
  'setList', 'horarios', 'anuncios', 'voluntarios',
];

// ── Main ──────────────────────────────────────────────────────────────────────

export function FichaEditorClient({ fichaId }: { fichaId: string }) {
  const { can, isAdmin } = usePermissions();
  const { ficha, loading, error } = useFichaRealtime(fichaId);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [viewMode, setViewMode] = useState<'document' | 'editor'>('editor');

  // Cuando carga la ficha, si está completa mostrar vista documento por defecto
  useEffect(() => {
    if (ficha?.status === 'complete') setViewMode('document');
  }, [ficha?.status]);

  const canEdit = isAdmin || can('fichas:edit') || can('fichas:admin');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 card animate-pulse bg-gray-100" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 card animate-pulse bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500 text-sm mb-4">{error ?? 'Ficha no encontrada'}</p>
        <Link href="/dashboard/fichas-tecnicas" className="btn-secondary text-sm">
          ← Volver al hub
        </Link>
      </div>
    );
  }

  const { bg, text } = statusColor(ficha.status);

  // ── Vista documento (ficha completa) ──────────────────────────────────────
  if (viewMode === 'document') {
    return (
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/fichas-tecnicas"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Fichas Técnicas
          </Link>
          <button
            onClick={() => setViewMode('editor')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-all hover:bg-gray-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Modo edición
          </button>
        </div>

        <FichaDocumentView ficha={ficha} onEdit={() => setViewMode('editor')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="card px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/fichas-tecnicas"
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{ficha.title}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-400">{ficha.campusName}</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400">{formatDate(ficha.date)}</span>
                <span className="text-gray-200">·</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={ficha.type === 'oracion'
                    ? { background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }
                    : { color: '#9CA3AF' }
                  }>
                  {ficha.type === 'oracion' ? '🙏 Encuentro de Oración'
                    : ficha.type === 'unico' ? 'Único encuentro'
                    : 'Multi-encuentro'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <SaveIndicator state={saveState} />
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: bg, color: text }}
            >
              {statusLabel(ficha.status)}
            </span>
            {ficha.status === 'complete' && (
              <button
                onClick={() => setViewMode('document')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: '#1D9E75', color: '#fff' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Vista documento
              </button>
            )}
          </div>
        </div>

        {/* Encuentros */}
        {ficha.encuentros?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            {ficha.encuentros.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border"
                style={{ borderColor: e.color + '40', color: e.color, background: e.color + '14' }}
              >
                {e.isLive && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                    style={{ background: e.color }} />
                )}
                {e.label}
                <span className="text-[10px] opacity-60">{e.time}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Secciones ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {SECTION_ORDER.map((sectionName) => {
          const section = ficha.sections?.[sectionName];
          if (!section) return null;
          return (
            <SectionPanel
              key={sectionName}
              fichaId={fichaId}
              sectionName={sectionName}
              section={section}
              encuentros={ficha.encuentros ?? []}
              canEdit={canEdit}
              fichaType={ficha.type}
              onSaveState={setSaveState}
            />
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="text-center pb-4">
        <p className="text-[11px] text-gray-300">
          Creada por <span className="text-gray-400">{ficha.createdByName}</span>
          {' · '}
          Última modificación:{' '}
          <span className="text-gray-400">{formatDate(ficha.lastModifiedAt)}</span>
        </p>
      </div>
    </div>
  );
}
