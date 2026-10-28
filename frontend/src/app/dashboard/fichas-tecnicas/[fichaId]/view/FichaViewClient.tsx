'use client';

import Link from 'next/link';
import { useFichaRealtime } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { FichaDocumentView } from '../FichaDocumentView';

export function FichaViewClient({ fichaId }: { fichaId: string }) {
  const { can, isAdmin } = usePermissions();
  const { ficha, loading, error } = useFichaRealtime(fichaId);
  const permisos = ficha?.permisos;
  const canEdit = permisos ? (permisos.content || permisos.sections.length > 0 || permisos.layoutVisual) : (isAdmin || can('fichas:edit') || can('fichas:admin'));

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
      </div>

      {/* Vista documento (read-only) */}
      <FichaDocumentView
        ficha={ficha}
        documentMode
        showHistory
        hiddenSections={ficha.hiddenSections ?? []}
        sectionLayout={ficha.sectionLayout}
        onEdit={canEdit ? () => { window.location.href = `/dashboard/fichas-tecnicas/${fichaId}`; } : undefined}
      />
    </div>
  );
}
