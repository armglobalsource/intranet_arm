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
          if (r.status === 404) throw new Error('not_found');
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
    const isNotFound     = error === 'not_found' || (error ?? '').includes('no encontrada');

    const emoji   = isNotPublished ? '🔒' : isNotFound ? '😭' : '⚠️';
    const title   = isNotPublished
      ? 'Esta ficha aún no está publicada'
      : isNotFound
        ? 'Puede que Jesús ya haya venido…'
        : 'No pudimos cargar la ficha';
    const detail  = isNotPublished
      ? 'Pídele al equipo de producción que la publique para poder verla.'
      : isNotFound
        ? '…y tú te has quedado. Esta ficha ya no está disponible — puede que haya sido despublicada o eliminada. Revisa la agenda de la semana.'
        : 'Intenta recargar en unos segundos.';

    return (
      <div style={{
        minHeight: '100vh', background: '#0d0d0d',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 24,
      }}>
        <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>
          {emoji}
        </div>
        <h1 style={{
          color: '#f0efec', fontSize: 20, fontWeight: 700, margin: 0,
          textAlign: 'center', letterSpacing: '-0.01em',
        }}>
          {title}
        </h1>
        <p style={{
          color: '#c4c1bc', fontSize: 14, margin: 0, textAlign: 'center',
          maxWidth: 340, lineHeight: 1.5,
        }}>
          {detail}
        </p>
        <a
          href="/agenda"
          style={{
            marginTop: 8, padding: '9px 18px', borderRadius: 10,
            background: 'rgba(127,119,221,0.14)', color: '#B7B0F0',
            border: '0.5px solid rgba(127,119,221,0.3)',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          Ir a la agenda
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>
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
