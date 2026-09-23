'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFichas, useDeleteFicha, useArchiveFicha, usePublishFicha, useUnpublishFicha } from '@/hooks/useFichas';
import { CloneModal } from '@/components/fichas/CloneModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useAuthStore } from '@/lib/store/auth.store';
import { useActiveCampuses } from '@/hooks/useCampus';
import { parseFichaDate } from '@/lib/ficha-date';
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

// ── Colores por sección ───────────────────────────────────────────────────────

const SECTION_COLORS: Record<SectionName, string> = {
  pastoral:    '#A78BFA', // violeta
  produccion:  '#FB923C', // naranja
  media:       '#22D3EE', // cian
  streaming:   '#60A5FA', // azul
  escena:      '#F472B6', // rosado
  setList:     '#FACC15', // amarillo
  horarios:    '#34D399', // verde esmeralda
  anuncios:    '#F87171', // coral
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
        <span className="text-[10px] text-white/40">Completitud</span>
        <span className="text-[10px] font-medium text-white/60">{pct}%</span>
      </div>
      {/* Segmentos por sección */}
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
        {sections.map((sec) => (
          <div
            key={sec}
            className="flex-1 rounded-full transition-all duration-300"
            style={{
              background: completionStatus[sec] ? '#1D9E75' : 'rgba(255,255,255,0.1)',
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
              style={{ color: done ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: done ? color : 'rgba(255,255,255,0.15)' }}
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
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-xl"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{ficha.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatDate(ficha.date)}</p>
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
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
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
          <p className="text-xs font-medium" style={{ color: isPublished ? '#34D399' : '#FCA5A5' }}>
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
                color: isPublished ? '#1D9E75' : '#F87171',
                border: `1px solid ${isPublished ? 'rgba(29,158,117,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              {(publishing || unpublishing)
                ? (isPublished ? 'Despublicando…' : 'Publicando…')
                : (isPublished ? 'Sí, despublicar' : 'Sí, publicar')}
            </button>
            <button onClick={() => setConfirmingPublish(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Confirmación de archivo */}
      {confirmingArchive && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <p className="text-xs font-medium" style={{ color: '#FCD34D' }}>¿Archivar esta ficha? Se ocultará del listado principal.</p>
          <div className="flex gap-2">
            <button onClick={handleArchive} disabled={archiving}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'rgba(251,191,36,0.2)', color: '#F59E0B', border: '1px solid rgba(251,191,36,0.3)' }}>
              {archiving ? 'Archivando…' : 'Sí, archivar'}
            </button>
            <button onClick={() => setConfirmingArchive(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {confirming && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-xs font-medium" style={{ color: '#FCA5A5' }}>¿Eliminar esta ficha? No se puede deshacer.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#EF4444', color: 'white' }}>
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button onClick={() => setConfirming(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
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
            href={`/dashboard/fichas-tecnicas/${ficha.fichaId}?edit=1`}
            className="flex-1 text-center text-xs font-medium py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            Abrir editor
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
              color: isPublished ? '#1D9E75' : '#F87171',
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
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
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
            background: copied ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.07)',
            color:      copied ? '#1D9E75' : 'rgba(255,255,255,0.5)',
            border:     `1px solid ${copied ? 'rgba(29,158,117,0.35)' : 'rgba(255,255,255,0.1)'}`,
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
              background: confirmingArchive ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.07)',
              color:      confirmingArchive ? '#F59E0B' : 'rgba(255,255,255,0.35)',
              border:     `1px solid ${confirmingArchive ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.1)'}`,
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
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
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
  canArchive,
  canPublish,
  currentUserId,
  onClone,
}: {
  campusName: string;
  fichas: FichaListItem[];
  canDelete: boolean;
  canArchive?: boolean;
  canPublish?: boolean;
  currentUserId?: number;
  onClone?: (ficha: FichaListItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalPct = fichas.length
    ? Math.round(fichas.reduce((a, f) => a + completionPercent(f.completionStatus, f.hiddenSections ?? []), 0) / fichas.length)
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
  const router = useRouter();
  const { can, isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);

  // Determinar campusId según rol (campus-scoped users ven solo su campus)
  const campusIdFilter = useMemo(() => {
    if (isAdmin || can('fichas:admin') || can('fichas:create')) return undefined;
    return user?.campus?.id?.toString() ?? undefined;
  }, [isAdmin, can, user]);

  const { data: fichas, isLoading, error, refetch } = useFichas(campusIdFilter);
  const { data: campusList = [] } = useActiveCampuses();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [cloneTarget,  setCloneTarget]  = useState<FichaListItem | null>(null);

  const canClone = isAdmin || can('fichas:create') || can('fichas:admin');

  // Mapa de normalización: id numérico → nombre canónico
  // y nombre normalizado → nombre canónico
  const campusNormMap = useMemo(() => {
    const byId:   Record<string, string> = {};
    const byNorm: Record<string, string> = {};
    campusList.forEach((c) => {
      byId[String(c.id)] = c.name;
      // normalizar: minúsculas, quitar prefijo "campus " o "arm "
      const norm = c.name.toLowerCase().replace(/^(campus|arm)\s+/, '').trim();
      byNorm[norm] = c.name;
    });
    return { byId, byNorm };
  }, [campusList]);

  /** Devuelve el nombre canónico del campus para agrupar */
  function canonicalName(f: FichaListItem): string {
    if (campusNormMap.byId[f.campusId]) return campusNormMap.byId[f.campusId];
    const norm = f.campusName.toLowerCase().replace(/^(campus|arm)\s+/, '').trim();
    if (campusNormMap.byNorm[norm]) return campusNormMap.byNorm[norm];
    return f.campusName;
  }

  // Filtrar y agrupar fichas por campus (usando nombre canónico)
  const grouped = useMemo(() => {
    if (!fichas) return {};
    // Excluir fichas archivadas del listado principal
    let filtered = fichas.filter((f) => !f.archived);

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
      const key = canonicalName(f);
      acc[key] = acc[key] ?? [];
      acc[key].push(f);
      return acc;
    }, {});
  }, [fichas, statusFilter, search, campusNormMap]);

  const campusNames = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);
  const canCreate = isAdmin || can('fichas:create') || can('fichas:admin');
  const canDelete = isAdmin || can('fichas:delete') || can('fichas:admin');
  const canArchive = isAdmin || can('fichas:edit') || can('fichas:admin');

  // ── Stats rápidos ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!fichas) return { total: 0, draft: 0, inProgress: 0, complete: 0, archived: 0 };
    const active = fichas.filter((f) => !f.archived);
    return {
      total:      active.length,
      draft:      active.filter((f) => f.status === 'draft').length,
      inProgress: active.filter((f) => f.status === 'in_progress').length,
      complete:   active.filter((f) => f.status === 'complete').length,
      archived:   fichas.filter((f) => f.archived).length,
    };
  }, [fichas]);

  if (!allowed) return null;

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',       value: stats.total,      color: '#374151',          href: undefined },
            { label: 'Borradores',  value: stats.draft,      color: 'rgba(0,0,0,0.3)',  href: undefined },
            { label: 'En progreso', value: stats.inProgress, color: '#7F77DD',          href: undefined },
            { label: 'Completas',   value: stats.complete,   color: '#1D9E75',          href: undefined },
            { label: 'Archivadas',  value: stats.archived,   color: '#F59E0B',          href: '/dashboard/fichas-tecnicas/archivadas' },
          ].map((s) =>
            s.href ? (
              <Link
                key={s.label}
                href={s.href}
                className="card px-4 py-3 flex items-center gap-3 transition-all hover:shadow-md hover:border-amber-200 group"
              >
                <span className="text-2xl font-bold transition-colors" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs text-gray-400 leading-tight group-hover:text-amber-500 transition-colors flex items-center gap-1">
                  {s.label}
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </Link>
            ) : (
              <div key={s.label} className="card px-4 py-3 flex items-center gap-3">
                <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs text-gray-400 leading-tight">{s.label}</span>
              </div>
            ),
          )}
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
            <CampusGroup
              key={name}
              campusName={name}
              fichas={grouped[name]}
              canDelete={canDelete}
              canArchive={canArchive}
              canPublish={isAdmin || can('fichas:create') || can('fichas:admin')}
              currentUserId={user?.id}
              onClone={canClone ? (f) => setCloneTarget(f) : undefined}
            />
          ))}
        </div>
      )}

      {/* Modal de clonación */}
      {cloneTarget && (
        <CloneModal ficha={cloneTarget} onClose={() => setCloneTarget(null)} />
      )}
    </div>
  );
}
