'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFichas, useDeleteFicha } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  completionPercent, statusColor, statusLabel,
  SECTION_LABELS,
} from '@/types/ficha';
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
  // Firestore Timestamp tiene .toDate(), string ISO, o number
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000); // Firestore Timestamp serializado
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FichaStatus }) {
  const { bg, text } = statusColor(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: bg, color: text }}
    >
      {statusLabel(status)}
    </span>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ completionStatus }: { completionStatus: Record<string, boolean> }) {
  const pct = completionPercent(completionStatus as any);
  const sections = Object.keys(completionStatus) as SectionName[];

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-400">Completitud</span>
        <span className="text-[10px] font-medium text-gray-600">{pct}%</span>
      </div>
      {/* Segmentos por sección */}
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
        {sections.map((sec) => (
          <div
            key={sec}
            className="flex-1 rounded-full transition-all duration-300"
            style={{
              background: completionStatus[sec]
                ? '#1D9E75'
                : 'rgba(0,0,0,0.08)',
            }}
            title={`${SECTION_LABELS[sec]}: ${completionStatus[sec] ? 'Completado' : 'Pendiente'}`}
          />
        ))}
      </div>
      {/* Leyenda compacta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {sections.map((sec) => (
          <span
            key={sec}
            className="flex items-center gap-1 text-[9px]"
            style={{ color: completionStatus[sec] ? '#1D9E75' : '#9CA3AF' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: completionStatus[sec] ? '#1D9E75' : '#D1D5DB' }}
            />
            {SECTION_LABELS[sec]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── FichaCard ─────────────────────────────────────────────────────────────────

function FichaCard({ ficha, canDelete }: { ficha: FichaListItem; canDelete: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const { mutate: deleteFicha, isPending: deleting } = useDeleteFicha();
  const isComplete = ficha.status === 'complete';

  function handleDelete() {
    deleteFicha(ficha.fichaId, {
      onSuccess: () => setConfirming(false),
    });
  }

  return (
    <div className="card p-4 hover:shadow-md transition-shadow group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{ficha.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(ficha.date)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge status={ficha.status} />
          <span
            className="text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.04)', color: '#6B7280' }}
          >
            {ficha.type === 'oracion' ? '🙏 Oración' : ficha.type === 'unico' ? 'Único' : 'Multi'}
          </span>
        </div>
      </div>

      <ProgressBar completionStatus={ficha.completionStatus} />

      {/* Confirmación de eliminación */}
      {confirming && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs text-red-700 font-medium">¿Eliminar esta ficha? No se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#EF4444', color: 'white' }}
            >
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 pt-1 border-t border-gray-100">
        {isComplete ? (
          <Link
            href={`/dashboard/fichas-tecnicas/${ficha.fichaId}/view`}
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(29,158,117,0.1)', color: '#1D9E75' }}
          >
            Ver ficha completa
          </Link>
        ) : (
          <Link
            href={`/dashboard/fichas-tecnicas/${ficha.fichaId}`}
            className="flex-1 text-center text-xs font-medium py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Abrir editor
          </Link>
        )}
        <Link
          href={`/dashboard/fichas-tecnicas/${ficha.fichaId}/view`}
          className="px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Ver ficha"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
        {canDelete && (
          <button
            onClick={() => setConfirming((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar ficha"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── CampusGroup ───────────────────────────────────────────────────────────────

function CampusGroup({
  campusName,
  fichas,
  canDelete,
}: {
  campusName: string;
  fichas: FichaListItem[];
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalPct = fichas.length
    ? Math.round(fichas.reduce((a, f) => a + completionPercent(f.completionStatus), 0) / fichas.length)
    : 0;
  const completas = fichas.filter((f) => f.status === 'complete').length;

  return (
    <div className="card overflow-hidden">
      {/* Header del campus */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 px-2 min-w-[2rem] text-[11px] tracking-wide"
            style={{ background: '#0d0d0d' }}
          >
            {getCampusInitials(campusName)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{campusName}</h3>
            <p className="text-[11px] text-gray-400">
              {fichas.length} {fichas.length === 1 ? 'ficha' : 'fichas'} · {completas} completa{completas !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini progress ring */}
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${totalPct}%`, background: totalPct === 100 ? '#1D9E75' : '#7F77DD' }}
              />
            </div>
            <span className="text-xs text-gray-400 w-8 text-right">{totalPct}%</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </button>

      {/* Grid de fichas */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {fichas.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No hay fichas para este campus</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
              {fichas.map((f) => (
                <FichaCard key={f.fichaId} ficha={f} canDelete={canDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filtros ───────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | FichaStatus;

// ── Main Component ────────────────────────────────────────────────────────────

export function FichasTecnicasClient() {
  const router = useRouter();
  const { can, isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);

  // Determinar campusId según rol (campus-scoped users ven solo su campus)
  const campusIdFilter = useMemo(() => {
    if (isAdmin || can('fichas:admin') || can('fichas:create')) return undefined;
    return user?.campus?.id?.toString() ?? undefined;
  }, [isAdmin, can, user]);

  const { data: fichas, isLoading, error, refetch } = useFichas(campusIdFilter);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  // Filtrar y agrupar fichas por campus
  const grouped = useMemo(() => {
    if (!fichas) return {};
    let filtered = fichas;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((f) => f.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.campusName.toLowerCase().includes(q),
      );
    }

    return filtered.reduce<Record<string, FichaListItem[]>>((acc, f) => {
      acc[f.campusName] = acc[f.campusName] ?? [];
      acc[f.campusName].push(f);
      return acc;
    }, {});
  }, [fichas, statusFilter, search]);

  const campusNames = Object.keys(grouped).sort();
  const canCreate = isAdmin || can('fichas:create') || can('fichas:admin');
  const canDelete = isAdmin || can('fichas:admin');

  // ── Stats rápidos ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!fichas) return { total: 0, draft: 0, inProgress: 0, complete: 0 };
    return {
      total:      fichas.length,
      draft:      fichas.filter((f) => f.status === 'draft').length,
      inProgress: fichas.filter((f) => f.status === 'in_progress').length,
      complete:   fichas.filter((f) => f.status === 'complete').length,
    };
  }, [fichas]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-500 text-sm mt-1">
            Formularios de producción semanal por campus
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canCreate && (
            <Link
              href="/dashboard/fichas-tecnicas/admin"
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nueva ficha
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      {!isLoading && fichas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',        value: stats.total,      color: '#374151' },
            { label: 'Borradores',   value: stats.draft,      color: 'rgba(0,0,0,0.3)' },
            { label: 'En progreso',  value: stats.inProgress, color: '#7F77DD' },
            { label: 'Completas',    value: stats.complete,   color: '#1D9E75' },
          ].map((s) => (
            <div key={s.label} className="card px-4 py-3 flex items-center gap-3">
              <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-xs text-gray-400 leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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

        {/* Filtro estado */}
        <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg">
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

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <svg className="w-10 h-10 text-red-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-gray-500 mb-3">No se pudieron cargar las fichas</p>
          <button onClick={() => refetch()} className="btn-secondary text-sm">
            Reintentar
          </button>
        </div>
      ) : campusNames.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p className="text-gray-500 text-sm font-medium mb-1">
            {search || statusFilter !== 'all' ? 'Sin resultados' : 'No hay fichas creadas'}
          </p>
          <p className="text-gray-400 text-xs mb-4">
            {search || statusFilter !== 'all'
              ? 'Prueba con otro filtro o término de búsqueda'
              : 'Crea la primera ficha técnica para comenzar'}
          </p>
          {canCreate && !search && statusFilter === 'all' && (
            <Link href="/dashboard/fichas-tecnicas/admin" className="btn-primary text-sm">
              Crear primera ficha
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {campusNames.map((name) => (
            <CampusGroup key={name} campusName={name} fichas={grouped[name]} canDelete={canDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
