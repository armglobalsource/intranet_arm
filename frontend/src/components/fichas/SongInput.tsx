'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanciones, useUpsertCancion } from '@/hooks/useCanciones';
import type { Cancion } from '@/types/ficha';

// Tokens del tema oscuro de la ficha (ver FichaDocumentView)
const D = {
  cardBorder:  'var(--song-border, rgba(255,255,255,0.07))',
  textPrimary: 'var(--song-primary, #f0efec)',
  textSecond:  'var(--song-secondary, #888580)',
  textMuted:   'var(--song-muted, #555350)',
  inputBorder: 'var(--song-border, rgba(255,255,255,0.18))',
} as const;

interface SongInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Llamado cuando el usuario selecciona una canción del catálogo (con todos sus datos) */
  onSongSelect?: (cancion: Cancion | null) => void;
  readOnly?: boolean;
  placeholder?: string;
}

/**
 * SongInput — campo inteligente para el Set List.
 * - Muestra sugerencias de canciones existentes mientras se escribe.
 * - Al confirmar (Enter / seleccionar / blur con texto), hace upsert en /canciones.
 * - Muestra la tonalidad de las canciones existentes como referencia.
 */
export function SongInput({ value, onChange, onSongSelect, readOnly = false, placeholder = 'Canción…' }: SongInputProps) {
  const [query, setQuery]       = useState(value);
  const [open, setOpen]         = useState(false);
  const [focused, setFocused]   = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);
  const dropdownRef             = useRef<HTMLDivElement>(null);
  const confirmedRef            = useRef(false);   // evita upsert doble

  // Sync cuando el valor externo cambia (e.g. Firestore update en otro cliente)
  useEffect(() => { setQuery(value); }, [value]);

  const { data: suggestions = [] } = useCanciones(focused ? query : '');
  const { mutate: upsert }          = useUpsertCancion();

  // Filtrar localmente para mayor velocidad
  const filtered: Cancion[] = query.trim()
    ? suggestions.filter((c) =>
        c.titulo.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 8)
    : suggestions.slice(0, 8);

  // ── Confirmar un valor (select o blur) ───────────────────────────────────
  const confirm = useCallback(
    (text: string, cancion?: Cancion) => {
      const titulo = text.trim();
      // Seleccionar con Enter una coincidencia exacta carga los mismos datos que un clic.
      const match = cancion ?? suggestions.find(c => c.titulo.trim().toLocaleLowerCase('es') === titulo.toLocaleLowerCase('es'));
      // Una sola actualización: el título y sus metadatos deben guardarse juntos.
      if (match && onSongSelect) onSongSelect(match);
      else { onChange(titulo); onSongSelect?.(null); }
      setQuery(titulo);
      setOpen(false);
      if (titulo && !confirmedRef.current) {
        confirmedRef.current = true;
        upsert({ titulo }, {
          onSettled: () => { confirmedRef.current = false; },
        });
      }
    },
    [onChange, onSongSelect, suggestions, upsert],
  );

  // ── Cerrar dropdown si se hace click fuera ───────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        inputRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (readOnly) {
    return (
      <div style={{ fontSize: 13, fontWeight: 500, color: value ? D.textPrimary : D.textMuted }}>
        {value || '—'}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={placeholder}
        style={{
          width: '100%',
          border: 'none',
          borderBottom: `1px dashed ${D.inputBorder}`,
          outline: 'none',
          background: 'transparent',
          padding: '1px 18px 1px 2px',
          fontSize: 13,
          fontWeight: 500,
          color: D.textPrimary,
          caretColor: '#7F77DD',
        }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => {
          setFocused(false);
          // Pequeño delay para permitir click en el dropdown
          setTimeout(() => {
            setOpen(false);
            if (query.trim() !== value) confirm(query);
          }, 150);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          confirmedRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirm(query);
            inputRef.current?.blur();
          }
          if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />

      {/* Icono de nota musical */}
      <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: D.textMuted }}>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </span>

      {/* Dropdown de sugerencias */}
      {open && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 overflow-hidden"
          style={{
            background: 'var(--song-surface, #1a1a1a)',
            border: `1px solid ${D.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {filtered.map((cancion) => (
            <button
              key={cancion.cancionId}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // evita blur antes de confirmar
                confirm(cancion.titulo, cancion);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span className="text-xs font-medium truncate" style={{ color: D.textPrimary }}>
                {cancion.titulo}
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {cancion.tipo && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: cancion.tipo.startsWith('Rápid') ? 'rgba(249,115,22,0.12)' : 'rgba(99,102,241,0.12)',
                      color:      cancion.tipo.startsWith('Rápid') ? '#f97316' : '#6366f1',
                    }}>
                    {cancion.tipo.startsWith('Rápid') ? '⚡' : '✨'}
                  </span>
                )}
                {cancion.bpm && (
                  <span className="text-[10px] font-medium" style={{ color: D.textSecond }}>{cancion.bpm} BPM</span>
                )}
                {cancion.hasLetra && <span className="text-[10px] text-emerald-700">Letra</span>}
                {cancion.tonalidad && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                    {cancion.tonalidad}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: D.textMuted }}>
                  ×{cancion.usageCount}
                </span>
              </span>
            </button>
          ))}
          {/* Opción para crear nueva si no existe exacta */}
          {query.trim() && !filtered.some((c) => c.titulo.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                confirm(query.trim());
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
              style={{
                background: 'transparent',
                border: 'none',
                borderTop: `0.5px solid ${D.cardBorder}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.1)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"
                stroke="#7F77DD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-xs" style={{ color: '#7F77DD' }}>
                Agregar &ldquo;<strong>{query.trim()}</strong>&rdquo;
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
