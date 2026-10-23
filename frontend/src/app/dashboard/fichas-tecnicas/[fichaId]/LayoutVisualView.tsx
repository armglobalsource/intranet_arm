'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ficha, LayoutVisual, LayoutVisualSlot, LayoutVisualSong, Row } from '@/types/ficha';
import { VisualReferencePicker } from '@/components/fichas/VisualReferencePicker';
import { RichTextEditor } from '@/components/fichas/RichTextEditor';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Corte AM/PM: encuentros con hora < 15:00 van a AM; ≥ 15:00 van a PM. */
const AM_PM_HOUR_CUTOFF = 15;

interface ParsedSong {
  titulo:    string;
  tonalidad: string;
}

function parseSongData(raw: string): ParsedSong {
  if (!raw) return { titulo: '', tonalidad: '' };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && 'titulo' in p) {
      return { titulo: p.titulo || '', tonalidad: p.tonalidad || '' };
    }
  } catch {}
  return { titulo: raw, tonalidad: '' };
}

function songTitleOf(row: Row): { titulo: string; tonalidad: string } {
  // Un row de setList puede tener values indexado por encuentro (e1, e2, unico)
  // O por 'shared'. Tomamos el primer valor no vacío.
  const raw =
    row.values?.['shared'] ||
    row.values?.['unico'] ||
    Object.values(row.values ?? {}).find((v) => v) ||
    '';
  return parseSongData(raw);
}

function isAmTime(time?: string): boolean {
  if (!time) return true;
  const h = Number(time.split(':')[0]);
  return Number.isFinite(h) && h < AM_PM_HOUR_CUTOFF;
}

/**
 * Deriva los "slots" del layout visual según la ficha:
 *   - 1 encuentro (unico/oracion) → 1 slot 'default'
 *   - 2+ encuentros:
 *       - Si hay AM (< 15:00) y PM (≥ 15:00): 2 slots.
 *       - Si todos son del mismo horario: 1 slot con label correspondiente.
 */
function deriveSlotDefs(ficha: Ficha): Array<{ id: string; label: string; encuentroIds: string[] }> {
  const encs = ficha.encuentros ?? [];
  if (encs.length <= 1) {
    return [{ id: 'default', label: '', encuentroIds: encs.map((e) => e.id) }];
  }
  const am = encs.filter((e) => isAmTime(e.time)).map((e) => e.id);
  const pm = encs.filter((e) => !isAmTime(e.time)).map((e) => e.id);
  if (am.length && pm.length) {
    return [
      { id: 'am', label: 'AM', encuentroIds: am },
      { id: 'pm', label: 'PM', encuentroIds: pm },
    ];
  }
  return [{
    id:           am.length ? 'am' : 'pm',
    label:        am.length ? 'AM' : 'PM',
    encuentroIds: encs.map((e) => e.id),
  }];
}

/**
 * Filtra las filas del setList para un slot dado: una canción aparece en el
 * slot si es shared (aplica a todos los encuentros) O si alguno de los
 * encuentros del slot tiene un título no vacío para esa fila.
 */
function filterRowsForSlot(rows: Row[], encuentroIds: string[]): Row[] {
  // Slot 'default' (o sin encuentroIds) = todas las filas.
  if (!encuentroIds || encuentroIds.length === 0) return rows;
  return rows.filter((row) => {
    if (row.shared) return true;
    return encuentroIds.some((eId) => {
      const raw = row.values?.[eId];
      if (!raw) return false;
      const parsed = parseSongData(raw);
      return !!parsed.titulo;
    });
  });
}

/**
 * Reconcilia las canciones de un slot con las filas del setList filtradas:
 * - agrega filas vacías para canciones nuevas
 * - descarta huérfanas (fila ya no existe en el slot)
 * - respeta el orden del setList
 * - preserva contenido editado
 */
function reconcile(
  setListRows: Row[],
  currentSongs: LayoutVisualSong[],
): LayoutVisualSong[] {
  const currentById = new Map(currentSongs.map((s) => [s.songRowId, s]));
  const sorted = [...setListRows].sort((a, b) => a.order - b.order);
  return sorted.map((row) => currentById.get(row.id) ?? {
    songRowId:          row.id,
    iluminacion:        '',
    illuminationColors: [],
    visualDescription:  '',
    referenceIds:       [],
  });
}

/**
 * Extrae el estado inicial de cada slot desde ficha.layoutVisual:
 *   - Si trae `slots[]` (forma nueva) → usa esos slots por id.
 *   - Si trae `songs[]` (legacy) → distribuye las mismas canciones a
 *     todos los slots derivados (cada slot filtrará las que apliquen).
 */
function loadSlotStates(
  layout: LayoutVisual | undefined,
  slotDefs: Array<{ id: string; label: string; encuentroIds: string[] }>,
): Record<string, { songs: LayoutVisualSong[]; producerNotes: string }> {
  const state: Record<string, { songs: LayoutVisualSong[]; producerNotes: string }> = {};
  const persistedSlots = layout?.slots ?? [];
  const legacySongs    = layout?.songs ?? [];
  const legacyNotes    = layout?.producerNotes ?? '';

  slotDefs.forEach((def, idx) => {
    const found = persistedSlots.find((s) => s.id === def.id);
    if (found) {
      state[def.id] = {
        songs:         found.songs ?? [],
        producerNotes: found.producerNotes ?? '',
      };
    } else {
      // Fallback legacy: primer slot hereda las notas y canciones,
      // los demás arrancan vacíos.
      state[def.id] = {
        songs:         idx === 0 ? legacySongs : [],
        producerNotes: idx === 0 ? legacyNotes : '',
      };
    }
  });

  return state;
}

// ── IlluminationColorSwatches ─────────────────────────────────────────────────

/**
 * Fila de swatches de color con color picker nativo. Cada swatch es
 * clickeable para editar (input type=color oculto) y tiene una X para
 * quitar en hover. Botón "+" para agregar un color nuevo (default #7F77DD).
 * En modo readonly solo muestra los swatches sin controles.
 */
function IlluminationColorSwatches({
  colors, editable, onChange, max = 10,
}: {
  colors: string[];
  editable: boolean;
  onChange?: (next: string[]) => void;
  max?: number;
}) {
  function updateColor(index: number, hex: string) {
    if (!onChange) return;
    onChange(colors.map((c, i) => (i === index ? hex : c)));
  }
  function removeColor(index: number) {
    if (!onChange) return;
    onChange(colors.filter((_, i) => i !== index));
  }
  function addColor() {
    if (!onChange || colors.length >= max) return;
    onChange([...colors, '#7F77DD']);
  }

  if (!editable) {
    if (colors.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
        {colors.map((c, i) => (
          <div
            key={i}
            title={c}
            style={{
              width: 20, height: 20, borderRadius: 4,
              background: c,
              border: '0.5px solid rgba(255,255,255,0.18)',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
      {colors.map((c, i) => (
        <label
          key={i}
          className="ficha-no-print"
          title={`${c} — click para cambiar`}
          style={{
            position: 'relative', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 22, height: 22, borderRadius: 4,
              background: c,
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
            }}
          />
          <input
            type="color"
            value={c}
            onChange={(e) => updateColor(i, e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
          />
          {onChange && (
            <button
              onMouseDown={(e) => { e.preventDefault(); removeColor(i); }}
              title="Quitar"
              style={{
                position: 'absolute', top: -5, right: -5,
                width: 14, height: 14, borderRadius: '50%',
                background: '#DC2626', color: '#fff',
                border: '1.5px solid #1a1a1a',
                fontSize: 9, lineHeight: 1, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, opacity: 0,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
            >
              ×
            </button>
          )}
        </label>
      ))}

      {/* Versión estática visible en print */}
      {colors.length > 0 && (
        <div className="ficha-print-only" style={{ display: 'none', gap: 3, flexWrap: 'wrap' }}>
          {colors.map((c, i) => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: 3, background: c, border: '0.5px solid #666' }} />
          ))}
        </div>
      )}

      {colors.length < max && onChange && (
        <button
          onClick={addColor}
          className="ficha-no-print"
          title="Agregar color"
          style={{
            width: 22, height: 22, borderRadius: 4,
            border: `1px dashed rgba(127,119,221,0.5)`,
            background: 'rgba(127,119,221,0.08)',
            color: '#7F77DD',
            cursor: 'pointer',
            fontSize: 13, lineHeight: 1, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, padding: 0,
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

// ── LayoutVisualView ──────────────────────────────────────────────────────────

interface LayoutVisualViewProps {
  ficha:    Ficha;
  editable: boolean;
  /** Filas locales del setList (para reflejar edición en vivo, no solo el snapshot). */
  localSetListRows?: Row[];
  /** Guardado optimista con debounce; el editor decide cómo persistir. */
  onSave?: (patch: { slots: LayoutVisualSlot[] }) => void;
}

const D = {
  cardBg:      '#FFFFFF',
  cardBorder:  '#DEE3EB',
  divider:     '#EDF0F4',
  headerBg:    '#F1F3F8',
  textPrimary: '#243047',
  textSecond:  '#526078',
  textMuted:   '#69768B',
  inputBorder: '#CCD4E1',
};
const TEAL = '#0D9488';

type SlotState = { songs: LayoutVisualSong[]; producerNotes: string };

export function LayoutVisualView({
  ficha, editable, localSetListRows, onSave,
}: LayoutVisualViewProps) {
  // Fuente de canciones: prioriza local (editando en vivo) sobre el snapshot
  const setListRows = localSetListRows ?? ficha.sections?.setList?.rows ?? [];

  // Slots derivados según ficha (1 para unico/oracion, 1-2 para multi por hora)
  const slotDefs = useMemo(() => deriveSlotDefs(ficha), [ficha]);

  // Estado por slot: { [slotId]: { songs, producerNotes } }
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>(() =>
    loadSlotStates(ficha.layoutVisual, slotDefs)
  );
  const [activeSlotId, setActiveSlotId] = useState<string>(slotDefs[0]?.id ?? 'default');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync desde afuera: cuando ficha.layoutVisual cambia (otro usuario guardó)
  // o cuando cambia el setList, mergea con estado local sin perder ediciones.
  useEffect(() => {
    setSlotStates((prev) => {
      const persistedSlots = ficha.layoutVisual?.slots ?? [];
      const legacySongs    = ficha.layoutVisual?.songs ?? [];
      const legacyNotes    = ficha.layoutVisual?.producerNotes ?? '';
      const next: Record<string, SlotState> = {};
      slotDefs.forEach((def, idx) => {
        const local     = prev[def.id];
        const persisted = persistedSlots.find((s) => s.id === def.id);
        const localSongs  = local?.songs ?? [];
        const remoteSongs = persisted?.songs ?? (idx === 0 ? legacySongs : []);
        const merged = new Map(localSongs.map((s) => [s.songRowId, s]));
        remoteSongs.forEach((s) => { if (!merged.has(s.songRowId)) merged.set(s.songRowId, s); });
        next[def.id] = {
          songs:         Array.from(merged.values()),
          producerNotes:
            local?.producerNotes
            ?? persisted?.producerNotes
            ?? (idx === 0 ? legacyNotes : ''),
        };
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setListRows.map((r) => r.id).join(','), ficha.layoutVisual?.updatedAt, slotDefs.map((s) => s.id).join(',')]);

  // Si el slot activo dejó de existir (cambió el tipo de ficha), resetear al primero.
  useEffect(() => {
    if (!slotDefs.find((s) => s.id === activeSlotId)) {
      setActiveSlotId(slotDefs[0]?.id ?? 'default');
    }
  }, [slotDefs, activeSlotId]);

  function scheduleSave(nextStates: Record<string, SlotState>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const slots: LayoutVisualSlot[] = slotDefs.map((def) => ({
        id:            def.id,
        label:         def.label,
        encuentroIds:  def.encuentroIds,
        songs:         nextStates[def.id]?.songs ?? [],
        producerNotes: nextStates[def.id]?.producerNotes ?? '',
      }));
      onSave?.({ slots });
      debounceRef.current = null;
    }, 800);
  }

  function updateSongInSlot(slotId: string, songRowId: string, patch: Partial<LayoutVisualSong>) {
    setSlotStates((prev) => {
      const current = prev[slotId] ?? { songs: [], producerNotes: '' };
      let nextSongs: LayoutVisualSong[];
      if (current.songs.find((s) => s.songRowId === songRowId)) {
        nextSongs = current.songs.map((s) =>
          s.songRowId === songRowId ? { ...s, ...patch } : s
        );
      } else {
        // Fila derivada por reconcile que aún no estaba en state: crearla.
        nextSongs = [...current.songs, {
          songRowId,
          iluminacion:        '',
          illuminationColors: [],
          visualDescription:  '',
          referenceIds:       [],
          ...patch,
        }];
      }
      const next = { ...prev, [slotId]: { ...current, songs: nextSongs } };
      scheduleSave(next);
      return next;
    });
  }

  function updateNotesInSlot(slotId: string, nextHtml: string) {
    setSlotStates((prev) => {
      const current = prev[slotId] ?? { songs: [], producerNotes: '' };
      const next = { ...prev, [slotId]: { ...current, producerNotes: nextHtml } };
      scheduleSave(next);
      return next;
    });
  }

  const titlesById = useMemo(() => {
    const m = new Map<string, { titulo: string; tonalidad: string }>();
    setListRows.forEach((r) => m.set(r.id, songTitleOf(r)));
    return m;
  }, [setListRows]);

  const isMulti = slotDefs.length > 1;

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      {/* Header interno */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        paddingBottom: 12, borderBottom: `0.5px solid ${D.divider}`,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Layout Visual
          </div>
          <div style={{ fontSize: 11, color: D.textSecond, marginTop: 2 }}>
            {isMulti
              ? 'Ficha multi-encuentro: layouts separados AM y PM (por hora del encuentro). Cada canción aparece solo en el layout de los horarios donde se toca.'
              : 'Iluminación y visuales por canción del Set List. Se sincroniza automáticamente cuando editás el Set List.'}
          </div>
        </div>
      </div>

      {/* Tabs AM/PM — solo cuando hay 2+ slots. Ocultas en print. */}
      {isMulti && (
        <div className="ficha-no-print" style={{
          display: 'flex', gap: 6, marginBottom: 16,
        }}>
          {slotDefs.map((def) => {
            const active = def.id === activeSlotId;
            return (
              <button
                key={def.id}
                onClick={() => setActiveSlotId(def.id)}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: active ? 'rgba(13,148,136,0.18)' : 'rgba(255,255,255,0.04)',
                  color: active ? TEAL : D.textSecond,
                  border: `0.5px solid ${active ? 'rgba(13,148,136,0.4)' : D.cardBorder}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  letterSpacing: '0.06em',
                }}
              >
                {def.label}
                <span style={{ marginLeft: 6, opacity: 0.7, fontWeight: 400 }}>
                  · {def.encuentroIds.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Slots (todos renderizados; solo el activo visible en pantalla).
          En print CSS hace visibles ambos con page-break entre ellos. */}
      {slotDefs.map((def, idx) => {
        const state = slotStates[def.id] ?? { songs: [], producerNotes: '' };
        const filteredRows = filterRowsForSlot(setListRows, def.encuentroIds);
        const reconciledSongs = reconcile(filteredRows, state.songs);
        return (
          <div
            key={def.id}
            className={`layout-slot ${idx > 0 ? 'layout-slot-break' : ''}`}
            style={{ display: def.id === activeSlotId ? 'block' : 'none' }}
          >
            {/* Etiqueta de slot (solo en print, para diferenciar AM/PM) */}
            {isMulti && (
              <div className="ficha-print-only" style={{
                display: 'none', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
                color: TEAL, marginBottom: 10, textTransform: 'uppercase',
              }}>
                Layout {def.label}
              </div>
            )}
            <LayoutSlotBody
              songs={reconciledSongs}
              producerNotes={state.producerNotes}
              titlesById={titlesById}
              editable={editable}
              onUpdateSong={(rowId, patch) => updateSongInSlot(def.id, rowId, patch)}
              onUpdateNotes={(html) => updateNotesInSlot(def.id, html)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── LayoutSlotBody ────────────────────────────────────────────────────────────

interface LayoutSlotBodyProps {
  songs:          LayoutVisualSong[];
  producerNotes:  string;
  titlesById:     Map<string, { titulo: string; tonalidad: string }>;
  editable:       boolean;
  onUpdateSong:   (rowId: string, patch: Partial<LayoutVisualSong>) => void;
  onUpdateNotes:  (html: string) => void;
}

function LayoutSlotBody({
  songs, producerNotes, titlesById, editable, onUpdateSong, onUpdateNotes,
}: LayoutSlotBodyProps) {
  const hasSongs = songs.length > 0;
  return (
    <>
      {!hasSongs ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          background: D.cardBg, borderRadius: 12, border: `0.5px dashed ${D.cardBorder}`,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>🎵</div>
          <p style={{ fontSize: 13, fontWeight: 600, color: D.textPrimary, margin: 0 }}>
            El Set List está vacío
          </p>
          <p style={{ fontSize: 11.5, color: D.textSecond, marginTop: 4 }}>
            Agregá canciones al Set List desde la vista principal de la ficha,
            y aparecerán aquí para armar el layout visual.
          </p>
        </div>
      ) : (
        <div className="layout-visual-table" style={{
          background: D.cardBg,
          border: `0.5px solid ${D.cardBorder}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Encabezado */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1.4fr 2fr',
            background: D.headerBg,
            borderBottom: `0.5px solid ${D.divider}`,
            padding: '10px 14px',
            gap: 12,
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: D.textSecond,
          }}>
            <div>Canción</div>
            <div>Iluminación</div>
            <div>Visuales</div>
            <div>Referencias</div>
          </div>

          {/* Filas */}
          {songs.map((song, i) => {
            const title = titlesById.get(song.songRowId) ?? { titulo: '', tonalidad: '' };
            const isLast = i === songs.length - 1;
            return (
              <div
                key={song.songRowId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1.4fr 2fr',
                  padding: '12px 14px',
                  gap: 12,
                  alignItems: 'flex-start',
                  borderBottom: isLast ? 'none' : `0.5px solid ${D.divider}`,
                }}
              >
                {/* Columna Canción */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: D.textPrimary,
                    wordBreak: 'break-word', lineHeight: 1.35,
                  }}>
                    {title.titulo || <span style={{ color: D.textMuted, fontStyle: 'italic' }}>Sin título</span>}
                  </div>
                  {title.tonalidad && (
                    <span style={{
                      display: 'inline-block', marginTop: 4,
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(99,102,241,0.12)', color: '#818CF8',
                    }}>
                      {title.tonalidad}
                    </span>
                  )}
                </div>

                {/* Columna Iluminación */}
                <div style={{ minWidth: 0 }}>
                  {editable ? (
                    <>
                      <textarea
                        value={song.iluminacion}
                        onChange={(e) => onUpdateSong(song.songRowId, { iluminacion: e.target.value })}
                        placeholder="AZUL, LILA + NARANJO…"
                        rows={2}
                        className="ficha-no-print"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'rgba(255,255,255,0.03)',
                          border: `0.5px solid ${D.inputBorder}`,
                          borderRadius: 6,
                          color: D.textPrimary,
                          fontSize: 12, fontFamily: 'inherit',
                          padding: '6px 8px',
                          resize: 'vertical',
                          outline: 'none',
                          lineHeight: 1.4,
                          colorScheme: 'light',
                        }}
                      />
                      {/* Print-only mirror: el textarea se oculta en print. */}
                      <span className="ficha-print-only" style={{ display: 'none', fontSize: 11, whiteSpace: 'pre-wrap' }}>
                        {song.iluminacion || ''}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: song.iluminacion ? D.textPrimary : D.textMuted, whiteSpace: 'pre-wrap' }}>
                      {song.iluminacion || (song.illuminationColors && song.illuminationColors.length > 0 ? '' : '—')}
                    </span>
                  )}
                  {/* Paleta cromática de referencia (swatches) */}
                  <IlluminationColorSwatches
                    colors={song.illuminationColors ?? []}
                    editable={editable}
                    onChange={editable ? (next) => onUpdateSong(song.songRowId, { illuminationColors: next }) : undefined}
                  />
                </div>

                {/* Columna Visuales */}
                <div style={{ minWidth: 0 }}>
                  {editable ? (
                    <>
                      <textarea
                        value={song.visualDescription}
                        onChange={(e) => onUpdateSong(song.songRowId, { visualDescription: e.target.value })}
                        placeholder="VISUALES LISTAS GLOBAL / 2026 / …"
                        rows={2}
                        className="ficha-no-print"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'rgba(255,255,255,0.03)',
                          border: `0.5px solid ${D.inputBorder}`,
                          borderRadius: 6,
                          color: D.textPrimary,
                          fontSize: 12, fontFamily: 'inherit',
                          padding: '6px 8px',
                          resize: 'vertical',
                          outline: 'none',
                          lineHeight: 1.4,
                          colorScheme: 'light',
                        }}
                      />
                      <span className="ficha-print-only" style={{
                        display: 'none', fontSize: 11, whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word', overflowWrap: 'anywhere' as const,
                      }}>
                        {song.visualDescription || ''}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: song.visualDescription ? D.textPrimary : D.textMuted, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' as const }}>
                      {song.visualDescription || '—'}
                    </span>
                  )}
                </div>

                {/* Columna Referencias */}
                <div style={{ minWidth: 0 }}>
                  <VisualReferencePicker
                    value={song.referenceIds}
                    onChange={(next) => onUpdateSong(song.songRowId, { referenceIds: next })}
                    editable={editable}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notas del productor — rich text abajo de la tabla */}
      {(editable || producerNotes) && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 10, paddingBottom: 8,
            borderBottom: `0.5px solid ${D.divider}`,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Notas del layout
              </div>
              <div style={{ fontSize: 11, color: D.textSecond, marginTop: 2 }}>
                Espacio libre para instrucciones, versos bíblicos, anuncios de despedida, referencias, etc. Usá la barra de herramientas para formatear.
              </div>
            </div>
          </div>
          <RichTextEditor
            value={producerNotes}
            editable={editable}
            onChange={onUpdateNotes}
            placeholder="Escribí acá las instrucciones, títulos, versos, anuncios…"
          />
        </div>
      )}
    </>
  );
}
