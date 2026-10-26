'use client';

import { useState, useMemo, useId } from 'react';
import Link from 'next/link';
import { Globe2, MapPin, Search, Archive, SlidersHorizontal, X } from 'lucide-react';
import { useFichas, useDeleteFicha, useArchiveFicha, usePublishFicha, useUnpublishFicha } from '@/hooks/useFichas';
import { CloneModal } from '@/components/fichas/CloneModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useAuthStore } from '@/lib/store/auth.store';
import { useAllCampuses } from '@/hooks/useCampus';
import { parseFichaDate } from '@/lib/ficha-date';
import { buildFichaDirectory, groupFichaDirectory, normalizeSearch } from '@/lib/ficha-directory';
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
  const d = parseFichaDate(raw);
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FichaStatus }) {
  const { bg, text } = status === 'draft' ? { bg: '#F1F5F9', text: '#475569' } : statusColor(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: bg, color: text }}
    >
      {statusLabel(status)}
    </span>
  );
}

// ── Colores por sección ───────────────────────────────────────────────────────

const SECTION_COLORS: Record<SectionName, string> = {
  pastoral:    '#A78BFA', // violeta
  produccion:  '#FB923C', // naranja
  media:       '#22D3EE', // cian
  streaming:   '#60A5FA', // azul
  escena:      '#F472B6', // rosado
  setList:     '#FACC15', // amarillo
  horarios:    '#047857', // verde esmeralda
  anuncios:    '#B91C1C', // coral
  voluntarios: '#A3E635', // lima
  outfit:      '#C084FC', // lila
};

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ completionStatus, hiddenSections }: { completionStatus: Record<string, boolean>; hiddenSections?: SectionName[] }) {
  const pct = completionPercent(completionStatus as any, hiddenSections ?? []);
  const sections = (Object.keys(completionStatus) as SectionName[])
    .filter((section) => !(hiddenSections ?? []).includes(section));

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-slate-500">Secciones completadas</span>
        <span className="text-[10px] font-medium text-slate-600">{pct}%</span>
      </div>
      {/* Segmentos por sección */}
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
        {sections.map((sec) => (
          <div
            key={sec}
            className="flex-1 rounded-full transition-all duration-300"
            style={{
              background: completionStatus[sec] ? '#1D9E75' : '#E2E8F0',
            }}
            title={`${SECTION_LABELS[sec]}: ${completionStatus[sec] ? 'Completado' : 'Pendiente'}`}
          />
        ))}
      </div>
      {/* Leyenda compacta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {sections.map((sec) => {
          const color = SECTION_COLORS[sec] ?? '#9CA3AF';
          const done  = completionStatus[sec];
          return (
            <span
              key={sec}
              className="flex items-center gap-1 text-[9px]"
              style={{ color: done ? '#475569' : '#64748B' }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: done ? color : '#CBD5E1' }}
              />
              {SECTION_LABELS[sec]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── FichaCard ─────────────────────────────────────────────────────────────────

function FichaCard({ ficha, canDelete, canArchive, canPublish, onClone }: { ficha: FichaListItem; canDelete: boolean; canArchive?: boolean; canPublish?: boolean; onClone?: () => void }) {
  const [confirming,         setConfirming]         = useState(false);
  const [confirmingArchive,  setConfirmingArchive]  = useState(false);
  const [confirmingPublish,  setConfirmingPublish]  = useState(false);
  const [copied,             setCopied]             = useState(false);
  const { mutate: deleteFicha,    isPending: deleting    } = useDeleteFicha();
  const { mutate: archiveFicha,   isPending: archiving   } = useArchiveFicha();
  const { mutate: publishFicha,   isPending: publishing  } = usePublishFicha();
  const { mutate: unpublishFicha, isPending: unpublishing } = useUnpublishFicha();
  const isComplete = ficha.status === 'complete';
  const isPublished = ficha.published ?? false;

  function handleDelete() {
    deleteFicha(ficha.fichaId, { onSuccess: () => setConfirming(false) });
  }

  function handleArchive() {
    archiveFicha(ficha.fichaId, { onSuccess: () => setConfirmingArchive(false) });
  }

  function handlePublish() {
    publishFicha(ficha.fichaId, { onSuccess: () => setConfirmingPublish(false) });
  }

  function handleUnpublish() {
    unpublishFicha(ficha.fichaId, { onSuccess: () => setConfirmingPublish(false) });
  }

  function handleShare() {
    const url = `${window.location.origin}/ficha/${String(ficha.fichaId)}`;
    const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(markCopied).catch(() => fallbackCopy(url, markCopied));
    } else {
      fallbackCopy(url, markCopied);
    }
  }

  function fallbackCopy(url: string, onSuccess: () => void) {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { onSuccess(); return; }
    } catch {}
    window.prompt('Copia este link:', url);
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 border border-slate-200 bg-white transition-shadow duration-200 hover:shadow-md"
      style={{ background: '#FFFFFF' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 break-words">{ficha.title}</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{formatDate(ficha.date)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge status={ficha.status} />
          <div className="flex items-center gap-1">
            {isPublished && (
              <span
                className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75' }}
              >
                Publicada
              </span>
            )}
            <span
              className="text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded"
              style={{ background: '#F1F5F9', color: '#64748B' }}
            >
              {ficha.type === 'oracion' ? '🙏 Oración' : ficha.type === 'unico' ? 'Único' : 'Multi'}
            </span>
          </div>
        </div>
      </div>

      <ProgressBar completionStatus={ficha.completionStatus} hiddenSections={ficha.hiddenSections} />

      {/* Confirmación de publicar/despublicar */}
      {confirmingPublish && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{
            background: isPublished ? 'rgba(29,158,117,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${isPublished ? 'rgba(29,158,117,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
          <p className="text-xs font-medium" style={{ color: isPublished ? '#047857' : '#B91C1C' }}>
            {isPublished
              ? '¿Despublicar esta ficha? Dejará de ser visible para los asignados.'
              : '¿Publicar esta ficha? Será visible para los usuarios asignados y via link.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={isPublished ? handleUnpublish : handlePublish}
              disabled={publishing || unpublishing}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: isPublished ? 'rgba(29,158,117,0.2)' : 'rgba(239,68,68,0.2)',
                color: isPublished ? '#1D9E75' : '#B91C1C',
                border: `1px solid ${isPublished ? 'rgba(29,158,117,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              {(publishing || unpublishing)
                ? (isPublished ? 'Despublicando…' : 'Publicando…')
                : (isPublished ? 'Sí, despublicar' : 'Sí, publicar')}
            </button>
            <button onClick={() => setConfirmingPublish(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors"
              style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Confirmación de archivo */}
      {confirmingArchive && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <p className="text-xs font-medium" style={{ color: '#92400E' }}>¿Archivar esta ficha? Se ocultará del listado principal.</p>
          <div className="flex gap-2">
            <button onClick={handleArchive} disabled={archiving}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'rgba(251,191,36,0.2)', color: '#F59E0B', border: '1px solid rgba(251,191,36,0.3)' }}>
              {archiving ? 'Archivando…' : 'Sí, archivar'}
            </button>
            <button onClick={() => setConfirmingArchive(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors"
              style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {confirming && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-xs font-medium" style={{ color: '#B91C1C' }}>¿Eliminar esta ficha? No se puede deshacer.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#EF4444', color: 'white' }}>
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button onClick={() => setConfirming(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors"
              style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
        {isComplete ? (
          <Link
            href={`/dashboard/fichas-tecnicas/${ficha.fichaId}/view`}
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75' }}
          >
            Ver ficha completa
          </Link>
        ) : (
          <Link
            href={`/dashboard/fichas-tecnicas/${ficha.fichaId}${canArchive ? '?edit=1' : ''}`}
            className="flex-1 text-center text-xs font-medium py-1.5 rounded-lg transition-colors"
            style={{ background: '#F1F5F9', color: '#475569' }}
          >
            {canArchive ? 'Abrir editor' : 'Ver ficha'}
          </Link>
        )}

        {/* Publicar / Despublicar */}
        {canPublish && (
          <button
            onClick={() => { setConfirming(false); setConfirmingArchive(false); setConfirmingPublish((v) => !v); }}
            title={isPublished ? 'Despublicar ficha' : 'Publicar ficha'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: isPublished
                ? (confirmingPublish ? 'rgba(29,158,117,0.2)' : 'rgba(29,158,117,0.15)')
                : (confirmingPublish ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.12)'),
              color: isPublished ? '#1D9E75' : '#B91C1C',
              border: `1px solid ${isPublished ? 'rgba(29,158,117,0.35)' : 'rgba(239,68,68,0.35)'}`,
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}

        {/* Duplicar */}
        {onClone && (
          <button
            onClick={onClone}
            title="Duplicar ficha"
            className="px-2.5 py-1.5 rounded-lg transition-all"
            style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        )}

        {/* Compartir */}
        <button
          onClick={handleShare}
          title="Copiar link público"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: copied ? 'rgba(29,158,117,0.2)' : '#F1F5F9',
            color:      copied ? '#1D9E75' : '#64748B',
            border:     `1px solid ${copied ? 'rgba(29,158,117,0.35)' : '#E2E8F0'}`,
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

        {/* Archivar */}
        {canArchive && (
          <button
            onClick={() => { setConfirming(false); setConfirmingPublish(false); setConfirmingArchive((v) => !v); }}
            title="Archivar ficha"
            className="px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: confirmingArchive ? 'rgba(251,191,36,0.12)' : '#F1F5F9',
              color:      confirmingArchive ? '#F59E0B' : '#64748B',
              border:     `1px solid ${confirmingArchive ? 'rgba(251,191,36,0.25)' : '#E2E8F0'}`,
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </button>
        )}

        {canDelete && (
          <button
            onClick={() => { setConfirmingArchive(false); setConfirmingPublish(false); setConfirming((v) => !v); }}
            className="px-2.5 py-1.5 rounded-lg transition-colors"
            title="Eliminar ficha"
            style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
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
  initials,
  expanded,
  onToggle,
  fichas,
  canDelete,
  canArchive,
  canPublish,
  currentUserId,
  onClone,
}: {
  campusName: string;
  initials?: string | null;
  expanded: boolean;
  onToggle: () => void;
  fichas: FichaListItem[];
  canDelete: boolean;
  canArchive?: boolean;
  canPublish?: boolean;
  currentUserId?: number;
  onClone?: (ficha: FichaListItem) => void;
}) {
  const panelId = useId();
  const totalPct = fichas.length
    ? Math.round(fichas.reduce((a, f) => a + completionPercent(f.completionStatus, f.hiddenSections ?? []), 0) / fichas.length)
    : 0;
  const completas = fichas.filter((f) => f.status === 'complete').length;

  return (
    <div className="card overflow-hidden">
      {/* Header del campus */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-slate-50 transition-colors text-left focus-visible:outline-violet-500"
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 rounded-xl flex items-center justify-center text-violet-700 bg-violet-50 font-bold flex-shrink-0 px-2 min-w-[2.5rem] text-[11px] tracking-wide"
          >
            {initials || getCampusInitials(campusName)}
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
        <div id={panelId} className="px-4 pb-4 border-t border-gray-100 bg-slate-50/60">
          {fichas.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No hay fichas para este campus</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 pt-3">
              {fichas.map((f) => (
                <FichaCard
                  key={f.fichaId}
                  ficha={f}
                  canDelete={canDelete}
                  canArchive={canArchive}
                  canPublish={canPublish && (f.createdBy === currentUserId || canDelete)}
                  onClone={onClone ? () => onClone(f) : undefined}
                />
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
  const allowed = useRequirePermission('fichas:view');
  const { can, isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const canCreate = isAdmin || can('fichas:create') || can('fichas:admin');
  const canDelete = isAdmin || can('fichas:delete') || can('fichas:admin');
  const canArchive = isAdmin || can('fichas:edit') || can('fichas:admin');
  const campusIdFilter = canCreate ? undefined : (user?.campus?.id ?? user?.campusId)?.toString();
  const { data: fichas = [], isLoading, error, refetch } = useFichas(campusIdFilter);
  // Include inactive campuses so historical fichas retain their country.
  const { data: campuses = [], isLoading: loadingCampuses, error: campusError, refetch: refetchCampuses } = useAllCampuses();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandAll, setExpandAll] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<FichaListItem | null>(null);

  const directory = useMemo(() => buildFichaDirectory(fichas, campuses), [fichas, campuses]);
  const active = useMemo(() => directory.filter((entry) => !entry.ficha.archived), [directory]);
  const countries = useMemo(() => groupFichaDirectory(active), [active]);
  const campusOptions = useMemo(() => countries
    .filter((country) => !countryFilter || country.key === countryFilter)
    .flatMap((country) => country.campuses.map((campus) => ({ ...campus, country: country.name })))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')), [countries, countryFilter]);
  const scope = useMemo(() => active.filter((entry) =>
    (!countryFilter || entry.countryKey === countryFilter) &&
    (!campusFilter || entry.campusKey === campusFilter) &&
    (!search.trim() || entry.searchText.includes(normalizeSearch(search))),
  ), [active, countryFilter, campusFilter, search]);
  const filtered = useMemo(() => scope.filter((entry) => statusFilter === 'all' || entry.ficha.status === statusFilter), [scope, statusFilter]);
  const grouped = useMemo(() => groupFichaDirectory(filtered), [filtered]);
  const stats = [
    { key: 'all' as const, label: 'Fichas activas', value: scope.length, color: 'text-slate-800' },
    { key: 'draft' as const, label: 'Borradores', value: scope.filter((e) => e.ficha.status === 'draft').length, color: 'text-slate-600' },
    { key: 'in_progress' as const, label: 'En progreso', value: scope.filter((e) => e.ficha.status === 'in_progress').length, color: 'text-violet-700' },
    { key: 'complete' as const, label: 'Completas', value: scope.filter((e) => e.ficha.status === 'complete').length, color: 'text-emerald-700' },
  ];
  const hasFilters = !!countryFilter || !!campusFilter || !!search || statusFilter !== 'all';
  const automaticallyExpanded = !!search.trim() || !!campusFilter || statusFilter !== 'all';
  const loading = isLoading || loadingCampuses;
  const selectedCountry = countries.find((c) => c.key === countryFilter);
  const visibleCampuses = grouped.reduce((sum, country) => sum + country.campuses.length, 0);

  function resetFilters() {
    setCountryFilter(''); setCampusFilter(''); setSearch(''); setStatusFilter('all');
    setExpanded({}); setExpandAll(false);
  }
  function selectCountry(key: string) {
    setCountryFilter(key); setCampusFilter(''); setExpanded({});
  }

  if (!allowed) return null;
  return (
    <div className="space-y-6 min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-2">Producción global</p>
          <h1 className="text-2xl font-bold text-slate-900">Fichas Técnicas</h1>
          <p className="text-slate-500 text-sm mt-1">Organiza cada encuentro, desde el país hasta su campus.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/fichas-tecnicas/archivadas" className="btn-secondary flex items-center gap-2 text-sm">
            <Archive size={15} aria-hidden="true" /> Archivadas
          </Link>
          {canCreate && <Link href="/dashboard/fichas-tecnicas/admin" className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
            <span aria-hidden="true">+</span> Nueva ficha
          </Link>}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4" aria-label="Cargando fichas">
          {[1, 2, 3].map((i) => <div key={i} className="card h-28 animate-pulse bg-slate-100" />)}
        </div>
      ) : error || campusError ? (
        <div className="card p-8 text-center" role="alert">
          <p className="text-sm text-slate-600 mb-3">{error ? 'No se pudieron cargar las fichas.' : 'No se pudo cargar el catálogo de países y campus.'}</p>
          <button onClick={() => { refetch(); refetchCampuses(); }} className="btn-secondary text-sm">Reintentar</button>
        </div>
      ) : (
        <>
          <section aria-label="Filtrar por país" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex flex-wrap justify-between gap-2 mb-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Globe2 size={17} className="text-violet-600" aria-hidden="true" /> Países</h2>
              <span className="text-xs text-slate-500">Selecciona dónde quieres trabajar</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => selectCountry('')} aria-pressed={!countryFilter}
                className={'rounded-xl border px-4 py-3 text-left transition-colors ' + (!countryFilter ? 'border-violet-300 bg-violet-50 text-violet-800 ring-1 ring-violet-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                <span className="block text-sm font-semibold">Todos los países</span>
                <span className="block mt-1 text-xs opacity-80">{active.length} fichas activas</span>
              </button>
              {countries.map((country) => {
                const total = country.campuses.reduce((n, campus) => n + campus.fichas.length, 0);
                return <button key={country.key} onClick={() => selectCountry(country.key)} aria-pressed={countryFilter === country.key}
                  className={'rounded-xl border px-4 py-3 text-left transition-colors ' + (countryFilter === country.key ? 'border-violet-300 bg-violet-50 text-violet-800 ring-1 ring-violet-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  <span className="block text-sm font-semibold">{country.name}</span>
                  <span className="block mt-1 text-xs opacity-80">{country.campuses.length} campus · {total} {total === 1 ? 'ficha' : 'fichas'}</span>
                </button>;
              })}
            </div>
          </section>

          <section aria-label="Buscar y filtrar fichas" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <label className="relative flex-1 min-w-0">
                <span className="sr-only">Buscar ficha, campus o país</span>
                <Search size={17} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
                <input type="search" placeholder="Buscar ficha, campus o país…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setExpanded({}); }} className="input w-full pl-10" />
              </label>
              <label className="relative lg:w-64">
                <span className="sr-only">Campus</span>
                <MapPin size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" aria-hidden="true" />
                <select aria-label="Campus" value={campusFilter} onChange={(e) => { setCampusFilter(e.target.value); setExpanded({}); }} className="input w-full pl-9 pr-8">
                  <option value="">Todos los campus</option>
                  {campusOptions.map((campus) => <option key={campus.key} value={campus.key}>{campus.name}{!countryFilter ? ' · ' + campus.country : ''}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal size={15} className="text-slate-400 mr-1" aria-hidden="true" />
              {stats.map((stat) => <button key={stat.key} aria-pressed={statusFilter === stat.key}
                onClick={() => { setStatusFilter(stat.key); setExpanded({}); }}
                className={'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ' + (statusFilter === stat.key ? 'bg-violet-700 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100')}>
                {stat.key === 'all' ? 'Todos los estados' : stat.label}
              </button>)}
              {hasFilters && <button onClick={resetFilters} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"><X size={14} aria-hidden="true" /> Limpiar filtros</button>}
            </div>
          </section>

          <section aria-label="Resumen de la selección" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {stats.map((stat) => <button key={stat.key} onClick={() => { setStatusFilter(stat.key); setExpanded({}); }}
              aria-label={stat.label + ': ' + stat.value} aria-pressed={statusFilter === stat.key}
              className={'rounded-xl border bg-white px-4 py-3 text-left transition-colors hover:border-violet-300 ' + (statusFilter === stat.key ? 'border-violet-300' : 'border-slate-200')}>
              <span className={'block text-2xl font-bold ' + stat.color}>{stat.value}</span>
              <span className="block text-xs text-slate-500 mt-1">{stat.label}</span>
            </button>)}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500" role="status">
              <strong className="text-slate-800">{filtered.length}</strong> {filtered.length === 1 ? 'ficha' : 'fichas'} en {visibleCampuses} campus
              {selectedCountry ? ' · ' + selectedCountry.name : ''}
            </p>
            {filtered.length > 0 && <div className="flex gap-3 text-xs font-semibold text-violet-700">
              <button onClick={() => { setExpandAll(true); setExpanded({}); }}>Expandir campus</button>
              <span className="text-slate-300" aria-hidden="true">|</span>
              <button onClick={() => { setExpandAll(false); setExpanded(Object.fromEntries(grouped.flatMap((c) => c.campuses.map((campus) => [campus.key, false])))); }}>Contraer campus</button>
            </div>}
          </div>

          {grouped.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-sm">
              <Search size={30} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-700">{hasFilters ? 'No encontramos fichas con estos filtros' : 'Todavía no hay fichas activas'}</h2>
              <p className="mt-2 mb-4 text-xs text-slate-500">{hasFilters ? 'Prueba con otro país, campus o estado.' : 'Crea una ficha técnica para organizar el próximo encuentro.'}</p>
              {hasFilters ? <button onClick={resetFilters} className="btn-secondary text-sm">Limpiar filtros</button>
                : canCreate && <Link href="/dashboard/fichas-tecnicas/admin" className="btn-primary text-sm">Crear primera ficha</Link>}
            </div>
          ) : grouped.map((country) => (
            <section key={country.key} aria-label={'Fichas de ' + country.name} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><Globe2 size={18} className="text-violet-500" aria-hidden="true" />{country.name}</h2>
                <span className="text-xs text-slate-500">{country.campuses.length} campus · {country.campuses.reduce((n, c) => n + c.fichas.length, 0)} fichas</span>
              </div>
              {country.name === 'Sin país asignado' && <p className="text-xs text-amber-800 rounded-lg bg-amber-50 px-3 py-2">El país se configura en el directorio de campus. Las fichas siguen disponibles aquí.</p>}
              {country.campuses.map((campus) => {
                const isExpanded = expanded[campus.key] ?? (expandAll || automaticallyExpanded);
                return <CampusGroup key={campus.key} campusName={campus.name} initials={campus.initials}
                  fichas={campus.fichas} expanded={isExpanded} onToggle={() => setExpanded((prev) => ({ ...prev, [campus.key]: !isExpanded }))}
                  canDelete={canDelete} canArchive={canArchive} canPublish={canCreate} currentUserId={user?.id}
                  onClone={canCreate ? (f) => setCloneTarget(f) : undefined} />;
              })}
            </section>
          ))}
        </>
      )}
      {cloneTarget && <CloneModal ficha={cloneTarget} onClose={() => setCloneTarget(null)} />}
    </div>
  );
}
