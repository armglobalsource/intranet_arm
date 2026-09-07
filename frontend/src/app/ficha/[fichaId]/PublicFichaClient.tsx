'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FichaDocumentView } from '@/app/dashboard/fichas-tecnicas/[fichaId]/FichaDocumentView';
import type { Ficha } from '@/types/ficha';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:3001/api/v1'
    : '/api/v1');

export function PublicFichaClient({ fichaId }: { fichaId: string }) {
  const [ficha, setFicha]     = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const queryClient           = useQueryClient();

  useEffect(() => {
    if (!fichaId) { setError('ID de ficha inválido'); setLoading(false); return; }
    fetch(`${API_BASE}/fichas/public/${fichaId}`)
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 403) throw new Error('not_published');
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.message ?? `Error ${r.status}`);
        }
        return r.json();
      })
      .then((data: Ficha) => {
        // Prepopular el cache de React Query con las paletas y visual refs
        // que vienen enriquecidas desde el endpoint público. Así los hooks
        // usePaletas() y useVisualReferences() encuentran datos en cache y
        // no disparan fetch a endpoints privados (que requerirían auth y
        // redirigirían a login).
        //
        // Usamos setQueryDefaults con staleTime infinito para estas queries
        // solo en modo público, garantizando que no refetch bajo ninguna
        // circunstancia.
        if (data.publicMeta) {
          queryClient.setQueryDefaults(['paletas'], { staleTime: Infinity, gcTime: Infinity });
          queryClient.setQueryDefaults(['visual-references'], { staleTime: Infinity, gcTime: Infinity });
          queryClient.setQueryData(['paletas'], data.publicMeta.paletas ?? []);
          queryClient.setQueryData(['visual-references', 'list', ''], data.publicMeta.visualRefs ?? []);
        }
        setFicha(data);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [fichaId, queryClient]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d0d0d',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg style={{ animation: 'spin 1s linear infinite', color: '#555' }}
          width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !ficha) {
    const isNotPublished = error === 'not_published';
    return (
      <div style={{
        minHeight: '100vh', background: '#0d0d0d',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'rgba(127,119,221,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {isNotPublished ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            )}
          </svg>
        </div>
        <p style={{ color: '#888', fontSize: 14, textAlign: 'center', maxWidth: 280 }}>
          {isNotPublished
            ? 'Esta ficha aún no ha sido publicada y no está disponible públicamente.'
            : (error ?? 'Ficha no encontrada')}
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{
        maxWidth: 900, margin: '0 auto 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(127,119,221,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#7F77DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#888', letterSpacing: '0.05em' }}>
            ARM Global
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#444' }}>Vista de solo lectura</span>
      </div>

      {/* Ficha (read-only, sin botón editar) */}
      <FichaDocumentView ficha={ficha} hiddenSections={ficha.hiddenSections ?? []} />
    </div>
  );
}
