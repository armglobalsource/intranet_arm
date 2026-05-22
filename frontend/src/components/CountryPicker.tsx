'use client';

import { useState, useRef, useEffect } from 'react';

// Lista de países en español — los más comunes primero
export const COUNTRIES: string[] = [
  'Chile', 'Venezuela', 'Colombia', 'Argentina', 'México', 'Perú', 'Ecuador',
  'Bolivia', 'Paraguay', 'Uruguay', 'Brasil', 'Estados Unidos', 'España',
  'Panamá', 'Costa Rica', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
  'Cuba', 'República Dominicana', 'Puerto Rico', 'Haití', 'Jamaica',
  'Kenia', 'Nigeria', 'Ghana', 'Sudáfrica', 'Etiopía', 'Tanzania',
  'Francia', 'Italia', 'Alemania', 'Portugal', 'Reino Unido', 'Países Bajos',
  'Suecia', 'Noruega', 'Dinamarca', 'Suiza', 'Bélgica', 'Austria', 'Polonia',
  'Rumanía', 'Ucrania', 'Rusia', 'Australia', 'Nueva Zelanda', 'Canadá',
  'Israel', 'Turquía', 'Líbano', 'Egipto', 'Marruecos', 'India', 'China',
  'Japón', 'Corea del Sur', 'Filipinas', 'Indonesia', 'Singapur', 'Tailandia',
];

interface CountryPickerProps {
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  className?:   string;
  /** Si true usa estilos de panel del organigrama (más compacto) */
  compact?:     boolean;
}

export default function CountryPicker({ value, onChange, placeholder = 'Buscar país…', className = '', compact = false }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed  = value.trim().toLowerCase();
  const filtered = COUNTRIES.filter((c) => c.toLowerCase().includes(trimmed)).slice(0, 8);
  const showDrop = open && filtered.length > 0;

  const inputCls = compact
    ? 'w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors pr-6'
    : 'w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition pr-8';

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={inputCls}
          autoComplete="off"
        />
        {/* Globe icon */}
        <svg
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </div>

      {showDrop && (
        <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map((country) => (
            <button
              key={country}
              type="button"
              onMouseDown={() => { onChange(country); setOpen(false); }}
              className={`w-full text-left px-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors ${compact ? 'py-1.5 text-[12px] text-slate-700' : 'py-2 text-[13px] text-slate-700'}`}
            >
              {country}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
