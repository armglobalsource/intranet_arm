'use client';

// Piezas de formulario compartidas entre la lista de Personas, su modal de edición
// y la página de creación (nueva/page.tsx). Viven en un módulo aparte porque
// page.tsx no puede exportar nada distinto de la ruta (Next.js lo rechaza).

import { useEffect, useRef, useState } from 'react';
import { useActiveCampuses } from '@/hooks/useCampus';
import { useOrgAllTeams } from '@/hooks/useOrgChart';
import type { JobTitle } from '@/hooks/useJobTitles';

export const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', user: 'Usuario' };

// ── MultiJobTitleSelect ───────────────────────────────────────────────────────

interface MultiJobTitleSelectProps {
  selectedIds:   number[];
  onChange:      (ids: number[]) => void;
  allJobTitles:  JobTitle[];
  onCreateNew:   (name: string) => Promise<JobTitle>;
  lockedTitles?: { id: number; name: string }[];
}

export function MultiJobTitleSelect({ selectedIds, onChange, allJobTitles, onCreateNew, lockedTitles = [] }: MultiJobTitleSelectProps) {
  const [open,    setOpen]    = useState(false);
  const [input,   setInput]   = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = allJobTitles.filter(
    (jt) => jt.isActive && jt.name.toLowerCase().includes(input.toLowerCase()),
  );
  const exactMatch = allJobTitles.some((jt) => jt.name.toLowerCase() === input.trim().toLowerCase());
  const showCreate = input.trim().length > 1 && !exactMatch;

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  async function handleCreate() {
    if (!input.trim() || creating) return;
    setCreating(true);
    try {
      const jt = await onCreateNew(input.trim());
      onChange([...selectedIds, jt.id]);
      setInput('');
    } finally {
      setCreating(false);
    }
  }

  const selectedTitles = allJobTitles.filter((jt) => selectedIds.includes(jt.id));

  return (
    <div ref={ref} className="relative">
      {(lockedTitles.length > 0 || selectedTitles.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {lockedTitles.map((jt) => (
            <span
              key={`locked-${jt.id}`}
              title="Este cargo viene del organigrama — se edita desde Organigrama"
              className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[11px] font-medium px-2 py-1 rounded-full border border-slate-200"
            >
              <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" ry="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              {jt.name}
            </span>
          ))}
          {selectedTitles.map((jt) => (
            <span key={jt.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-medium px-2 py-1 rounded-full border border-blue-200">
              {jt.name}
              <button type="button" onClick={() => toggle(jt.id)} className="w-3 h-3 flex items-center justify-center text-blue-400 hover:text-red-500 transition-colors">×</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text" value={input} autoComplete="off"
        onChange={(e) => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (showCreate) handleCreate(); }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={selectedTitles.length > 0 ? 'Agregar otro cargo...' : 'Buscar o crear cargo...'}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
      />

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((jt) => (
            <button key={jt.id} type="button"
              onMouseDown={(e) => { e.preventDefault(); toggle(jt.id); }}
              className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 hover:bg-blue-50 transition-colors ${selectedIds.includes(jt.id) ? 'text-blue-700 font-medium' : 'text-slate-700'}`}
            >
              <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] ${selectedIds.includes(jt.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                {selectedIds.includes(jt.id) && '✓'}
              </span>
              {jt.name}
            </button>
          ))}
          {showCreate && (
            <button type="button"
              onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
              disabled={creating}
              className="w-full text-left px-3 py-2 text-[12.5px] font-medium text-violet-600 hover:bg-violet-50 flex items-center gap-2 border-t border-slate-100 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {creating ? 'Creando...' : `Crear "${input.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CampusSelect ──────────────────────────────────────────────────────────────

interface CampusSelectProps {
  value:    number | null;
  onChange: (id: number | null) => void;
}

export function CampusSelect({ value, onChange }: CampusSelectProps) {
  const { data: campuses = [] } = useActiveCampuses();
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white"
    >
      <option value="">Sin campus asignado</option>
      {campuses.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}

// ── TeamSelect (autocomplete) ─────────────────────────────────────────────────

interface TeamSelectProps {
  value:        number | null;
  onChange:     (id: number | null) => void;
  excludeIds?:  Set<number>;
  placeholder?: string;
}

export function TeamSelect({ value, onChange, excludeIds, placeholder = 'Buscar equipo…' }: TeamSelectProps) {
  const { data: teams = [] } = useOrgAllTeams();
  const [input, setInput]   = useState('');
  const [open,  setOpen]    = useState(false);

  const activeTeams  = teams.filter((t) => t.isActive && (!excludeIds || !excludeIds.has(t.id)));
  const selectedTeam = activeTeams.find((t) => t.id === value) ?? null;

  const teamLabel = (t: typeof activeTeams[0]) => `${t.icon ? `${t.icon} ` : ''}${t.name}`;

  const filtered = activeTeams
    .filter((t) => teamLabel(t).toLowerCase().includes(input.toLowerCase()))
    .slice(0, 8);

  const showDrop = open && filtered.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={selectedTeam ? teamLabel(selectedTeam) : input}
          onChange={(e) => { setInput(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition pr-7"
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onChange(null); setInput(''); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-base leading-none"
          >×</button>
        )}
      </div>

      {showDrop && (
        <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((team) => (
            <button
              key={team.id}
              type="button"
              onMouseDown={() => { onChange(team.id); setInput(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
            >
              {teamLabel(team)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
