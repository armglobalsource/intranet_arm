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

function formatDate(raw: any): string {
  if (!raw) return '—';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000);
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(raw: any): string {
  if (!raw) return '—';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function isUpcoming(raw: any): boolean {
  if (!raw) return false;
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000);
  return d >= new Date();
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
};

type StatusFilter = 'all' | FichaStatus;

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FichaStatus }) {
  const { bg, text } = statusColor(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
      style={{ background: bg, color: text }}
    >
      {statusLabel(status)}
    </span>
  );
}

// ── ProgressSegments ──────────────────────────────────────────────────────────

function ProgressSegments({ completionStatus }: { completionStatus: Record<string, boolean> }) {
  const sections = Object.keys(completionStatus) as SectionName[];
  const pct = completionPercent(completionStatus as any);

  return (
    <div>
      <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
        {sections.map((sec) => (
          <div
            key={sec}
            className="flex-1 transition-all duration-300"
            style={{ background: completionStatus[sec] ? SECTION_COLORS[sec] ?? '#1D9E75' : 'rgba(255,255,255,0.08)' }}
            title={`${SECTION_LABELS[sec]}: ${completionStatus[sec] ? 'Listo' : 'Pendiente'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {sections.filter(s => completionStatus[s]).map((sec) => (
            <span key={sec} className="text-[9px]" style={{ color: SECTION_COLORS[sec] ?? '#1D9E75' }}>
              {SECTION_LABELS[sec]}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-medium flex-shrink-0 ml-2" style={{ color: pct === 100 ? '#1D9E75' : 'rgba(255,255,255,0.4)' }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ── FichaRow — vista lista compacta ──────────────────────────────────────────

function FichaRow({ ficha }: { ficha: FichaListItem }) {
  const [copied, setCopied] = useState(false);
  const upcoming = isUpcoming(ficha.date);

  function handleShare() {
    const url = `${window.location.origin}/ficha/${String(ficha.fichaId)}`;
    const ok = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(ok).catch(() => fallback(url, ok));
    } else { fallback(url, ok); }
  }
  function fallback(url: string, onOk: () => void) {
    try {
      const ta = document.createElement('textarea');
      ta.value = url; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      if (document.execCommand('copy')) { document.body.removeChild(ta); onOk(); return; }
      document.body.removeChild(ta);
    } catch {}
    window.prompt('Copia este link:', url);
  }

  const href = ficha.status === 'complete'
    ? `/dashboard/fichas-tecnicas/${ficha.fichaId}/view`
    : `/dashboard/fichas-tecnicas/${ficha.fichaId}`;

  return (
    <div
      className="group flex flex-col gap-2 px-4 py-3.5 transition-all duration-150"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Fila principal */}
      <div className="flex items-center gap-3">
        {/* Icono fecha */}
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex flex-col items-center justify-center"
          style={{ background: upcoming ? 'rgba(127,119,221,0.15)' : 'rgba(255,255,255,0.06)' }}
        >
          <span className="text-[11px] font-bold leading-none" style={{ color: upcoming ? '#7F77DD' : 'rgba(255,255,255,0.5)' }}>
            {formatDateShort(ficha.date).split(' ')[0]}
          </span>
          <span className="text-[9px] uppercase tracking-wide leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {formatDateShort(ficha.date).split(' ')[1] ?? ''}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{ficha.title || 'Sin título'}</span>
            <StatusBadge status={ficha.status} />
            {upcoming && (
              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(127,119,221,0.15)', color: '#7F77DD' }}>
                Próximo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{ficha.campusName}</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span className="text-[11px] capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {ficha.type === 'oracion' ? 'Oración' : ficha.type === 'unico' ? 'Único' : 'Multi-encuentro'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatDate(ficha.date)}</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={handleShare}
            title="Copiar link público"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: copied ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.07)',
              color: copied ? '#1D9E75' : 'rgba(255,255,255,0.4)',
            }}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
          <Link
            href={href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: ficha.status === 'complete' ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.08)',
              color: ficha.status === 'complete' ? '#1D9E75' : 'rgba(255,255,255,0.6)',
            }}
          >
            {ficha.status === 'complete' ? 'Ver' : 'Abrir'}
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>

        {/* Botón siempre visible en mobile */}
        <Link
          href={href}
          className="sm:hidden flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {/* Progreso */}
      <ProgressSegments completionStatus={ficha.completionStatus} />
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ isAdmin, search, statusFilter }: { isAdmin: boolean; search: string; statusFilter: StatusFilter }) {
  const filtered = search || statusFilter !== 'all';
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {filtered ? 'Sin resultados' : isAdmin ? 'No hay fichas creadas' : 'No tienes fichas asignadas'}
      </p>
      <p className="text-xs text-center max-w-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
        {filtered
          ? 'Prueba con otro filtro o búsqueda'
          : isAdmin
            ? 'Crea la primera ficha en el panel de administración'
            : 'Aparecerán aquí las fichas en las que seas creador o responsable de sección'}
      </p>
      {isAdmin && !filtered && (
        <Link
          href="/dashboard/fichas-tecnicas/admin"
          className="mt-5 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(127,119,221,0.2)', color: '#7F77DD', border: '1px solid rgba(127,119,221,0.3)' }}
        >
          Ir al panel admin
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

  const stats = useMemo(() => {
    if (!fichas) return { total: 0, upcoming: 0, complete: 0, inProgress: 0 };
    return {
      total:      fichas.length,
      upcoming:   fichas.filter((f) => isUpcoming(f.date)).length,
      complete:   fichas.filter((f) => f.status === 'complete').length,
      inProgress: fichas.filter((f) => f.status === 'in_progress').length,
    };
  }, [fichas]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            {/* Icono documento negro */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#111111', border: '1px solid rgba(0,0,0,0.12)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
                stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
              ? 'Vista global de todas las fichas de producción'
              : `Fichas en las que participas${user?.firstName ? `, ${user.firstName}` : ''}`}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/fichas-tecnicas"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            style={{ background: '#111111', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Vista completa
          </Link>
        )}
      </div>

      {/* Stats rápidos */}
      {!isLoading && fichas && fichas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',       value: stats.total,      color: 'rgba(255,255,255,0.7)', dim: 'rgba(255,255,255,0.3)' },
            { label: 'Próximas',    value: stats.upcoming,   color: '#7F77DD',               dim: 'rgba(127,119,221,0.5)' },
            { label: 'En progreso', value: stats.inProgress, color: '#A78BFA',               dim: 'rgba(167,139,250,0.5)' },
            { label: 'Completas',   value: stats.complete,   color: '#1D9E75',               dim: 'rgba(29,158,117,0.5)'  },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-xs leading-tight" style={{ color: s.dim }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por título o campus…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none transition-all"
            style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }}
          />
        </div>

        {/* Filtro estado */}
        <div
          className="flex gap-1 p-1 rounded-xl flex-shrink-0"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {(['all', 'draft', 'in_progress', 'complete'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                statusFilter === s
                  ? { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }
                  : { color: 'rgba(255,255,255,0.3)' }
              }
            >
              {s === 'all' ? 'Todos' : statusLabel(s as FichaStatus)}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido principal */}
      {isLoading ? (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="px-4 py-3.5 animate-pulse"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', height: 80 }}
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.07)', width: '60%' }} />
                  <div className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '40%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-2xl p-10 flex flex-col items-center gap-3"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none"
            stroke="rgba(239,68,68,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Error al cargar fichas</p>
          <button
            onClick={() => refetch()}
            className="text-xs px-4 py-2 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <EmptyState isAdmin={isAdmin} search={search} statusFilter={statusFilter} />
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Contador */}
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
          >
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {filtered.length} {filtered.length === 1 ? 'ficha' : 'fichas'}
              {(search || statusFilter !== 'all') && ` · filtradas de ${fichas?.length ?? 0}`}
            </span>
            {(search || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); }}
                className="text-[11px] transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Lista */}
          {filtered.map((f) => (
            <FichaRow key={f.fichaId} ficha={f} />
          ))}
        </div>
      )}
    </div>
  );
}
