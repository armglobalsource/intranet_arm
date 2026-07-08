'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useFichas, useUnarchiveFicha } from '@/hooks/useFichas';
import { useActiveCampuses } from '@/hooks/useCampus';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/lib/store/auth.store';
import { completionPercent, statusColor, statusLabel, SECTION_LABELS } from '@/types/ficha';
import type { FichaListItem, FichaStatus, SectionName } from '@/types/ficha';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAMPUS_INITIALS: Record<string, string> = {
  'Santiago':      'CS',
  'Puente Alto':   'CPA',
  'Concepción':    'CCP',
  'Punta Arenas':  'CPS',
  'La Plata':      'CLP',
  'Montevideo':    'CMV',
  'Katy':          'CKT',
  'Maracaibo':     'CMR',
};

function getCampusInitials(name: string): string {
  return CAMPUS_INITIALS[name] ?? name.slice(0, 2).toUpperCase();
}

function formatDate(raw: any): string {
  if (!raw) return '—';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000);
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const SECTION_COLORS: Record<SectionName, string> = {
  pastoral:    '#A78BFA',
  produccion:  '#FB923C',
  streaming:   '#60A5FA',
  escena:      '#F472B6',
  setList:     '#FACC15',
  horarios:    '#34D399',
  anuncios:    '#F87171',
  voluntarios: '#A3E635',
  outfit:      '#C084FC',
};

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ completionStatus }: { completionStatus: Record<string, boolean> }) {
  const pct = completionPercent(completionStatus as any);
  const sections = Object.keys(completionStatus) as SectionName[];
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-white/40">Completitud</span>
        <span className="text-[10px] font-medium text-white/60">{pct}%</span>
      </div>
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
        {sections.map((sec) => (
          <div
            key={sec}
            className="flex-1 rounded-full transition-all duration-300"
            style={{ background: completionStatus[sec] ? '#1D9E75' : 'rgba(255,255,255,0.1)' }}
            title={`${SECTION_LABELS[sec]}: ${completionStatus[sec] ? 'Completado' : 'Pendiente'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {sections.map((sec) => {
          const color = SECTION_COLORS[sec] ?? '#9CA3AF';
          const done  = completionStatus[sec];
          return (
            <span key={sec} className="flex items-center gap-1 text-[9px]"
              style={{ color: done ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: done ? color : 'rgba(255,255,255,0.15)' }} />
              {SECTION_LABELS[sec]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FichaStatus }) {
  const { bg, text } = statusColor(status);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: bg, color: text }}>
      {statusLabel(status)}
    </span>
  );
}

// ── ArchivedFichaCard ─────────────────────────────────────────────────────────

function ArchivedFichaCard({ ficha }: { ficha: FichaListItem }) {
  const [confirmingUnarchive, setConfirmingUnarchive] = useState(false);
  const { mutate: unarchiveFicha, isPending: unarchiving } = useUnarchiveFicha();

  function handleUnarchive() {
    unarchiveFicha(ficha.fichaId, { onSuccess: () => setConfirmingUnarchive(false) });
  }

  const href = ficha.status === 'complete'
    ? `/dashboard/fichas-tecnicas/${ficha.fichaId}/view`
    : `/dashboard/fichas-tecnicas/${ficha.fichaId}`;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: '#111111', border: '1px solid rgba(251,191,36,0.15)' }}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{ficha.title}</p>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide flex-shrink-0"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#F59E0B' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              Archivada
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatDate(ficha.date)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge status={ficha.status} />
          <span className="text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
            {ficha.type === 'oracion' ? '🙏 Oración' : ficha.type === 'unico' ? 'Único' : 'Multi'}
          </span>
        </div>
      </div>

      <ProgressBar completionStatus={ficha.completionStatus} />

      {/* Confirmación Desarchivar */}
      {confirmingUnarchive && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <p className="text-xs font-medium" style={{ color: '#FCD34D' }}>
            ¿Desarchivar? La ficha volverá al listado principal.
          </p>
          <div className="flex gap-2">
            <button onClick={handleUnarchive} disabled={unarchiving}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'rgba(251,191,36,0.2)', color: '#F59E0B', border: '1px solid rgba(251,191,36,0.3)' }}>
              {unarchiving ? 'Desarchivando…' : 'Sí, desarchivar'}
            </button>
            <button onClick={() => setConfirmingUnarchive(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <Link
          href={href}
          className="flex-1 text-center text-xs font-medium py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
        >
          Ver ficha
        </Link>

        <button
          onClick={() => setConfirmingUnarchive((v) => !v)}
          title="Desarchivar ficha"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: confirmingUnarchive ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.08)',
            color: '#F59E0B',
            border: `1px solid ${confirmingUnarchive ? 'rgba(251,191,36,0.35)' : 'rgba(251,191,36,0.2)'}`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-4.51" />
          </svg>
          Desarchivar
        </button>
      </div>
    </div>
  );
}

// ── CampusSection ─────────────────────────────────────────────────────────────

function CampusSection({ campusName, fichas }: { campusName: string; fichas: FichaListItem[] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 px-2 min-w-[2rem] text-[11px] tracking-wide"
            style={{ background: '#0d0d0d' }}>
            {getCampusInitials(campusName)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{campusName}</h3>
            <p className="text-[11px] text-gray-400">
              {fichas.length} ficha{fichas.length !== 1 ? 's' : ''} archivada{fichas.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
            {fichas.map((f) => (
              <ArchivedFichaCard key={f.fichaId} ficha={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FichasArchivadasClient() {
  const { can, isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);

  const campusIdFilter = useMemo(() => {
    if (isAdmin || can('fichas:admin') || can('fichas:create')) return undefined;
    return user?.campus?.id?.toString() ?? undefined;
  }, [isAdmin, can, user]);

  const { data: fichas, isLoading } = useFichas(campusIdFilter);
  const { data: campusList = [] } = useActiveCampuses();

  const [search,        setSearch]        = useState('');
  const [campusFilter,  setCampusFilter]  = useState<string>('all');

  // Mapa de normalización igual al hub
  const campusNormMap = useMemo(() => {
    const byId:   Record<string, string> = {};
    const byNorm: Record<string, string> = {};
    campusList.forEach((c) => {
      byId[String(c.id)] = c.name;
      const norm = c.name.toLowerCase().replace(/^(campus|arm)\s+/, '').trim();
      byNorm[norm] = c.name;
    });
    return { byId, byNorm };
  }, [campusList]);

  function canonicalName(f: FichaListItem): string {
    if (campusNormMap.byId[f.campusId]) return campusNormMap.byId[f.campusId];
    const norm = f.campusName.toLowerCase().replace(/^(campus|arm)\s+/, '').trim();
    if (campusNormMap.byNorm[norm]) return campusNormMap.byNorm[norm];
    return f.campusName;
  }

  // Solo fichas archivadas
  const archived = useMemo(() => (fichas ?? []).filter((f) => f.archived), [fichas]);

  // Filtrar por búsqueda y campus
  const filtered = useMemo(() => {
    let result = archived;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) => f.title.toLowerCase().includes(q) || f.campusName.toLowerCase().includes(q),
      );
    }
    if (campusFilter !== 'all') {
      result = result.filter((f) => canonicalName(f) === campusFilter);
    }
    return result;
  }, [archived, search, campusFilter, campusNormMap]);

  // Agrupar por campus
  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, FichaListItem[]>>((acc, f) => {
        const key = canonicalName(f);
        acc[key] = acc[key] ?? [];
        acc[key].push(f);
        return acc;
      }, {}),
    [filtered, campusNormMap],
  );

  const campusNames = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  // Lista de campus disponibles para el filtro
  const availableCampuses = useMemo(() => {
    const seen: Record<string, true> = {};
    const result: string[] = [];
    for (const f of archived) {
      const name = canonicalName(f);
      if (!seen[name]) { seen[name] = true; result.push(name); }
    }
    return result.sort();
  }, [archived, campusNormMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/fichas-tecnicas"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
              Fichas Técnicas
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-base" style={{ background: 'rgba(251,191,36,0.12)' }}>
              🗄️
            </span>
            Fichas Archivadas
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isLoading ? 'Cargando…' : `${archived.length} ficha${archived.length !== 1 ? 's' : ''} archivada${archived.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar ficha o campus…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Filtro por campus */}
        {availableCampuses.length > 1 && (
          <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg flex-wrap">
            <button
              onClick={() => setCampusFilter('all')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                campusFilter === 'all' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Todos
            </button>
            {availableCampuses.map((name) => (
              <button
                key={name}
                onClick={() => setCampusFilter(name)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  campusFilter === name ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : archived.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </div>
          <p className="text-gray-700 text-sm font-semibold mb-1">No hay fichas archivadas</p>
          <p className="text-gray-400 text-xs mb-4">
            Las fichas que archives aparecerán aquí
          </p>
          <Link href="/dashboard/fichas-tecnicas" className="btn-secondary text-sm">
            ← Volver al hub
          </Link>
        </div>
      ) : campusNames.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 text-sm font-medium mb-1">Sin resultados</p>
          <p className="text-gray-400 text-xs">Prueba con otro campus o término de búsqueda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campusNames.map((name) => (
            <CampusSection key={name} campusName={name} fichas={grouped[name]} />
          ))}
        </div>
      )}
    </div>
  );
}
