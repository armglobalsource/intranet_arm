'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ficha, LayoutVisualSong, Row } from '@/types/ficha';
import { VisualReferencePicker } from '@/components/fichas/VisualReferencePicker';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * Reconcilia el layoutVisual con las canciones actuales del setList:
 * - agrega filas vacías para canciones nuevas (mismo songRowId)
 * - descarta filas huérfanas (cuya canción ya no existe)
 * - respeta el orden actual del setList
 * - preserva el contenido editado de las filas que aún existen
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
  onSave?: (songs: LayoutVisualSong[]) => void;
}

const D = {
  cardBg:      'rgba(255,255,255,0.04)',
  cardBorder:  'rgba(255,255,255,0.07)',
  divider:     'rgba(255,255,255,0.06)',
  headerBg:    'rgba(255,255,255,0.03)',
  textPrimary: '#f0efec',
  textSecond:  '#888580',
  textMuted:   '#555350',
  inputBorder: 'rgba(255,255,255,0.18)',
};
const TEAL = '#0D9488';

export function LayoutVisualView({
  ficha, editable, localSetListRows, onSave,
}: LayoutVisualViewProps) {
  // Fuente de canciones: prioriza local (editando en vivo) sobre el snapshot
  const setListRows = localSetListRows ?? ficha.sections?.setList?.rows ?? [];

  // State local con debounce. Se inicializa reconciliando con setList.
  const [songs, setSongs] = useState<LayoutVisualSong[]>(() =>
    reconcile(setListRows, ficha.layoutVisual?.songs ?? [])
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando cambia el setList (agregada/borrada una canción), reconciliar.
  // Cuando cambia layoutVisual desde afuera (otro usuario), también reconciliar.
  useEffect(() => {
    setSongs((prev) => {
      // Si prev tenía ediciones locales que aún no se guardaron, preservarlas.
      // reconcile hace merge por songRowId — así las ediciones se mantienen.
      const merged = new Map(prev.map((s) => [s.songRowId, s]));
      const fromServer = ficha.layoutVisual?.songs ?? [];
      fromServer.forEach((s) => {
        if (!merged.has(s.songRowId)) merged.set(s.songRowId, s);
      });
      return reconcile(setListRows, Array.from(merged.values()));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setListRows.map((r) => r.id).join(','), ficha.layoutVisual?.updatedAt]);

  function scheduleSave(next: LayoutVisualSong[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSave?.(next);
      debounceRef.current = null;
    }, 800);
  }

  function updateSong(songRowId: string, patch: Partial<LayoutVisualSong>) {
    setSongs((prev) => {
      const next = prev.map((s) => s.songRowId === songRowId ? { ...s, ...patch } : s);
      scheduleSave(next);
      return next;
    });
  }

  const hasSongs = songs.length > 0;

  const titlesById = useMemo(() => {
    const m = new Map<string, { titulo: string; tonalidad: string }>();
    setListRows.forEach((r) => m.set(r.id, songTitleOf(r)));
    return m;
  }, [setListRows]);

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
            Iluminación y visuales por canción del Set List. Se sincroniza automáticamente cuando editás el Set List.
          </div>
        </div>
      </div>

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
                    <textarea
                      value={song.iluminacion}
                      onChange={(e) => updateSong(song.songRowId, { iluminacion: e.target.value })}
                      placeholder="AZUL, LILA + NARANJO…"
                      rows={2}
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
                        colorScheme: 'dark' as any,
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: song.iluminacion ? D.textPrimary : D.textMuted, whiteSpace: 'pre-wrap' }}>
                      {song.iluminacion || (song.illuminationColors && song.illuminationColors.length > 0 ? '' : '—')}
                    </span>
                  )}
                  {/* Paleta cromática de referencia (swatches) */}
                  <IlluminationColorSwatches
                    colors={song.illuminationColors ?? []}
                    editable={editable}
                    onChange={editable ? (next) => updateSong(song.songRowId, { illuminationColors: next }) : undefined}
                  />
                </div>

                {/* Columna Visuales */}
                <div style={{ minWidth: 0 }}>
                  {editable ? (
                    <textarea
                      value={song.visualDescription}
                      onChange={(e) => updateSong(song.songRowId, { visualDescription: e.target.value })}
                      placeholder="VISUALES LISTAS GLOBAL / 2026 / …"
                      rows={2}
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
                        colorScheme: 'dark' as any,
                      }}
                    />
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
                    onChange={(next) => updateSong(song.songRowId, { referenceIds: next })}
                    editable={editable}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
