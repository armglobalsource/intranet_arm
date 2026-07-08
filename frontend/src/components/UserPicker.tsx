'use client';

import { useState, useMemo } from 'react';

export interface PickableUser {
  id:      number;
  name:    string;
  email:   string;
  campus?: string | null;
  area?:   string | null;
}

interface UserPickerProps {
  users:        PickableUser[];
  suggestions?: (PickableUser & { score: number })[];
  value:        number | null;
  onChange:     (userId: number | null) => void;
  placeholder?: string;
}

export default function UserPicker({ users, suggestions = [], value, onChange, placeholder = 'Buscar persona…' }: UserPickerProps) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');

  const selected = value != null ? users.find((u) => u.id === value) ?? null : null;
  // Solo el nombre en el valor seleccionado — mostrar el email actual acá podría
  // confundirse con el email real que se va a aplicar (que viene del Excel, no de acá).
  const displayValue = open ? query : (selected ? selected.name ?? '' : '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions.length > 0 ? suggestions.slice(0, 5) : users.slice(0, 8);
    return users
      .filter((u) => (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, users, suggestions]);

  const showDrop = open && filtered.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); if (value != null) onChange(null); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 pr-6 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-colors"
          autoComplete="off"
        />
        {selected && !open && (
          <button
            type="button"
            onMouseDown={() => { onChange(null); setQuery(''); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 text-sm leading-none px-1"
            title="Quitar match"
          >
            ×
          </button>
        )}
      </div>

      {showDrop && (
        <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={() => { onChange(u.id); setQuery(''); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
            >
              <p className="text-[12px] font-medium text-slate-800 truncate">{u.name || '(sin nombre)'}</p>
              <p className="text-[10.5px] text-slate-400 truncate">
                cuenta actual: {u.email || '—'}
                {'score' in u && typeof (u as any).score === 'number' && ` · ${Math.round((u as any).score * 100)}%`}
              </p>
              {(u.campus || u.area) && (
                <p className="text-[10.5px] text-slate-400 truncate">
                  {u.campus && <>campus: {u.campus}</>}
                  {u.campus && u.area && ' · '}
                  {u.area && <>área: {u.area}</>}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
