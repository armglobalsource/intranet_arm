'use client';

import Link from 'next/link';
import { useFichaRealtime } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { FichaDocumentView } from '../FichaDocumentView';

export function FichaViewClient({ fichaId }: { fichaId: string }) {
  const allowed = useRequirePermission('fichas:view');
  const { can, isAdmin } = usePermissions();
  const { ficha, loading, error } = useFichaRealtime(fichaId);
  const canEdit = isAdmin || can('fichas:edit') || can('fichas:admin');

  if (!allowed) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="rounded-2xl animate-pulse" style={{ height: 420, background: 'rgba(255,255,255,0.06)' }} />
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500 text-sm mb-4">{error ?? 'Ficha no encontrada'}</p>
        <Link href="/dashboard/fichas-tecnicas" className="btn-secondary text-sm">
          ← Volver al hub
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href="/dashboard/fichas-tecnicas"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Fichas Técnicas
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-all hover:bg-gray-50"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Imprimir / PDF
        </button>
      </div>

      {/* Vista documento (read-only) */}
      <FichaDocumentView
        ficha={ficha}
        showHistory
        hiddenSections={ficha.hiddenSections ?? []}
        sectionLayout={ficha.sectionLayout}
        onEdit={canEdit ? () => { window.location.href = `/dashboard/fichas-tecnicas/${fichaId}`; } : undefined}
      />
    </div>
  );
}
