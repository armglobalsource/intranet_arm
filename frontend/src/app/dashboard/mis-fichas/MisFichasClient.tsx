'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useMiFichas } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  completionPercent, statusColor, statusLabel,
  SECTION_LABELS,
} from '@/types/ficha';
import type { FichaListItem, FichaStatus, SectionName } from '@/types/ficha';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw?.toDate === 'function') return raw.toDate();
  if (typeof raw === 'string' || typeof raw === 'number') return new Date(raw);
  if (raw instanceof Date) return raw;
  if (raw.seconds) return new Date(raw.seconds * 1000);
  return null;
}

function formatFull(raw: any): string {
  const d = parseDate(raw);
  if (!d) return '—';
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShort(raw: any): string {
  const d = parseDate(raw);
  if (!d) return '—';
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function getMonthYear(raw: any): string {
  const d = parseDate(raw);
  if (!d) return 'Sin fecha';
  return d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
}

function isUpcoming(raw: any): boolean {
  const d = parseDate(raw);
  return d ? d >= new Date() : false;
}

function getDayNum(raw: any): string {
  const d = parseDate(raw);
  return d ? String(d.getDate()).padStart(2, '0') : '—';
}

function getMonthAbbr(raw: any): string {
  const d = parseDate(raw);
  if (!d) return '';
  return d.toLocaleDateString('es-CL', { month: 'short' }).toUpperCase().replace('.', '');
}

// ── Constantes visuales ───────────────────────────────────────────────────────

const SECTION_COLORS: Record<SectionName, string> = {
  pastoral:    '#8B5CF6',
  produccion:  '#F97316',
  streaming:   '#3B82F6',
  escena:      '#EC4899',
  setList:     '#EAB308',
  horarios:    '#10B981',
  anuncios:    '#EF4444',
  voluntarios: '#84CC16',
};

const STATUS_STYLES: Record<FichaStatus, { bg: string; text: string; border: string; dot: string }> = {
  complete:    { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC', dot: '#22C55E' },
  in_progress: { bg: '#F5F3FF', text: '#7C3AED', border: '#C4B5FD', dot: '#8B5CF6' },
  draft:       { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB', dot: '#9CA3AF' },
};

const CAMPUS_COLORS: Record<string, string> = {
  'Santiago':     '#6366F1',
  'Puente Alto':  '#0EA5E9',
  'Concepción':   '#10B981',
  'Punta Arenas': '#F59E0B',
  'La Plata':     '#EF4444',
  'Montevideo':   '#8B5CF6',
  'Katy':         '#EC4899',
  'Maracaibo':    '#F97316',
};

function campusColor(name: string): string {
  for (const [key, color] of Object.entries(CAMPUS_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#6B7280';
}

type StatusFilter = 'all' | FichaStatus;

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FichaStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {statusLabel(status)}
    </span>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ completionStatus }: { completionStatus: Record<string, boolean> }) {
  const sections = Object.keys(completionStatus) as SectionName[];
  const pct = completionPercent(completionStatus as any);
  return (
    <div className="mt-3">
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-gray-100">
        {sections.map((sec) => (
          <div
            key={sec}
            className="flex-1 transition-all duration-500"
            style={{ background: completionStatus[sec] ? SECTION_COLORS[sec] : 'transparent' }}
            title={`${SECTION_LABELS[sec]}: ${completionStatus[sec] ? 'Listo' : 'Pendiente'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {sections.filter((s) => completionStatus[s]).map((sec) => (
            <span key={sec} className="text-[9px] font-medium" style={{ color: SECTION_COLORS[sec] }}>
              {SECTION_LABELS[sec]}
            </span>
          ))}
          {sections.filter((s) => !completionStatus[s]).length > 0 && (
            <span className="text-[9px] text-gray-300">
              +{sections.filter((s) => !completionStatus[s]).length} pendiente{sections.filter((s) => !completionStatus[s]).length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-bold flex-shrink-0 ml-2"
          style={{ color: pct === 100 ? '#15803D' : pct > 0 ? '#7C3AED' : '#9CA3AF' }}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ── FichaCard ─────────────────────────────────────────────────────────────────

function FichaCard({ ficha }: { ficha: FichaListItem }) {
  const upcoming = isUpcoming(ficha.date);
  const st = STATUS_STYLES[ficha.status];
  const cc = campusColor(ficha.campusName);

  return (
    <Link
      href={`/ficha/${ficha.fichaId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl bg-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{ border: '1px solid #E5E7EB', overflow: 'hidden' }}
    >
      {/* Borde superior coloreado por estado */}
      <div className="h-1 w-full" style={{ background: st.dot }} />

      <div className="p-4">
        {/* Header: fecha + badges */}
        <div className="flex items-start gap-3">
          {/* Chip de fecha */}
          <div
            className="flex-shrink-0 w-11 rounded-xl flex flex-col items-center justify-center py-1.5 text-center"
            style={{ background: upcoming ? '#F5F3FF' : '#F9FAFB' }}
          >
            <span className="text-base font-extrabold leading-none" style={{ color: upcoming ? '#7C3AED' : '#374151' }}>
              {getDayNum(ficha.date)}
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: upcoming ? '#A78BFA' : '#9CA3AF' }}>
              {getMonthAbbr(ficha.date)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors line-clamp-2">
                {ficha.title || 'Sin título'}
              </p>
              {upcoming && (
                <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                  style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                  Próximo
                </span>
              )}
            </div>

            {/* Campus + tipo */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ background: `${cc}15`, color: cc }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: cc }} />
                {ficha.campusName}
              </span>
              <span className="text-gray-300 text-xs">·</span>
              <span className="text-[10px] text-gray-400 capitalize">
                {ficha.type === 'oracion' ? 'Oración' : ficha.type === 'unico' ? 'Único' : 'Multi'}
              </span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="mt-2.5 flex items-center justify-between">
          <StatusBadge status={ficha.status} />
          <span className="text-[10px] text-gray-400">{formatShort(ficha.date)}</span>
        </div>

        {/* Barra de progreso */}
        <ProgressBar completionStatus={ficha.completionStatus} />
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ background: '#FAFAFA', borderTop: '1px solid #F3F4F6' }}
      >
        <span className="text-[10px] text-gray-400 capitalize">{formatFull(ficha.date)}</span>
        <span
          className="text-[10px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#6366F1' }}
        >
          Ver ficha
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ isAdmin, filtered }: { isAdmin: boolean; filtered: boolean }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
        <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">
        {filtered ? 'Sin resultados' : isAdmin ? 'No hay fichas creadas' : 'No tienes fichas asignadas'}
      </p>
      <p className="text-xs text-gray-400 max-w-xs">
        {filtered
          ? 'Prueba con otro filtro o término de búsqueda'
          : isAdmin
            ? 'Crea la primera ficha en el panel de administración'
            : 'Aparecerán aquí las fichas donde seas creador o responsable de sección'}
      </p>
      {isAdmin && !filtered && (
        <Link href="/dashboard/fichas-tecnicas/admin" className="btn-primary text-sm mt-5">
          Crear primera ficha
        </Link>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MisFichasClient() {
  const { isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { data: fichas, isLoading, error, refetch } = useMiFichas();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');

  const filtered = useMemo(() => {
    if (!fichas) return [];
    let list = fichas;
    if (statusFilter !== 'all') list = list.filter((f) => f.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.title.toLowerCase().includes(q) || f.campusName.toLowerCase().includes(q));
    }
    return list;
  }, [fichas, statusFilter, search]);

  // Agrupar por mes
  const grouped = useMemo(() => {
    const map: Record<string, FichaListItem[]> = {};
    for (const f of filtered) {
      const key = getMonthYear(f.date);
      (map[key] ??= []).push(f);
    }
    return map;
  }, [filtered]);
  const months = Object.keys(grouped);

  const stats = useMemo(() => {
    if (!fichas) return { total: 0, upcoming: 0, complete: 0, inProgress: 0 };
    return {
      total:      fichas.length,
      upcoming:   fichas.filter((f) => isUpcoming(f.date)).length,
      complete:   fichas.filter((f) => f.status === 'complete').length,
      inProgress: fichas.filter((f) => f.status === 'in_progress').length,
    };
  }, [fichas]);

  const hasFilter = search.trim() !== '' || statusFilter !== 'all';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Fichas Técnicas</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {isAdmin
              ? 'Vista global de todas las fichas · solo lectura'
              : `Fichas en las que participas${user?.firstName ? `, ${user.firstName}` : ''} · solo lectura`}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/fichas-tecnicas"
            className="btn-secondary flex items-center gap-2 text-sm flex-shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Gestionar fichas
          </Link>
        )}
      </div>

      {/* Stats */}
      {!isLoading && fichas && fichas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',       value: stats.total,      color: '#111827', bg: '#F9FAFB', border: '#E5E7EB' },
            { label: 'Próximas',    value: stats.upcoming,   color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
            { label: 'En progreso', value: stats.inProgress, color: '#9333EA', bg: '#FAF5FF', border: '#E9D5FF' },
            { label: 'Completas',   value: stats.complete,   color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            >
              <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-xs font-medium" style={{ color: s.color, opacity: 0.6 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por título o campus…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg flex-shrink-0">
          {(['all', 'draft', 'in_progress', 'complete'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'Todos' : statusLabel(s as FichaStatus)}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card h-52 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : error ? (
        <div className="card p-10 flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-red-300" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-gray-500">Error al cargar las fichas</p>
          <button onClick={() => refetch()} className="btn-secondary text-sm">Reintentar</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState isAdmin={isAdmin} filtered={hasFilter} />
      ) : (
        <div className="space-y-8">
          {/* Resultado total cuando hay filtros activos */}
          {hasFilter && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{filtered.length}</span> {filtered.length === 1 ? 'ficha' : 'fichas'} encontradas
              </p>
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); }}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Agrupado por mes */}
          {months.map((month) => (
            <div key={month}>
              {/* Separador de mes */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest capitalize">
                  {month}
                </h2>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-300 font-medium">
                  {grouped[month].length} {grouped[month].length === 1 ? 'ficha' : 'fichas'}
                </span>
              </div>

              {/* Grid de tarjetas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[month].map((f) => (
                  <FichaCard key={f.fichaId} ficha={f} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
