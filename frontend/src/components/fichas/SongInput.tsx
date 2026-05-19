'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanciones, useUpsertCancion } from '@/hooks/useCanciones';
import type { Cancion } from '@/types/ficha';

interface SongInputProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

/**
 * SongInput — campo inteligente para el Set List.
 * - Muestra sugerencias de canciones existentes mientras se escribe.
 * - Al confirmar (Enter / seleccionar / blur con texto), hace upsert en /canciones.
 * - Muestra la tonalidad de las canciones existentes como referencia.
 */
export function SongInput({ value, onChange, readOnly = false, placeholder = 'Canción…' }: SongInputProps) {
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
    (text: string) => {
      const titulo = text.trim();
      onChange(titulo);
      setQuery(titulo);
      setOpen(false);
      if (titulo && !confirmedRef.current) {
        confirmedRef.current = true;
        upsert({ titulo }, {
          onSettled: () => { confirmedRef.current = false; },
        });
      }
    },
    [onChange, upsert],
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
      <div className="input text-xs py-1.5 bg-gray-50 cursor-default text-gray-700">
        {value || <span className="text-gray-300 italic">—</span>}
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
        className="input text-xs py-1.5 w-full pr-6"
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
      <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-3 h-3 text-gray-300" viewBox="0 0 24 24" fill="none"
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
          className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          {filtered.map((cancion) => (
            <button
              key={cancion.cancionId}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // evita blur antes de confirmar
                confirm(cancion.titulo);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-medium text-gray-800 truncate">
                {cancion.titulo}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                {cancion.tonalidad && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                    {cancion.tonalidad}
                  </span>
                )}
                <span className="text-[10px] text-gray-400">
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
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50 transition-colors border-t border-gray-100"
            >
              <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-xs text-indigo-600">
                Agregar "<strong>{query.trim()}</strong>"
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
