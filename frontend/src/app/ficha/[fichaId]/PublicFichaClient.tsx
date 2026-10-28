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
    return <main className="public-ficha-page"><p role="status" className="public-ficha-message">Cargando ficha técnica…</p></main>;
  }

  if (error || !ficha) {
    const isNotPublished = error === 'not_published';
    const isNotFound = error === 'not_found' || (error ?? '').includes('no encontrada');
    return <main className="public-ficha-page">
      <div className="public-ficha-message" role="alert">
        <h1>{isNotPublished ? 'Esta ficha aún no está publicada' : isNotFound ? 'Ficha no disponible' : 'No pudimos cargar la ficha'}</h1>
        <p>{isNotPublished ? 'Pídele al equipo de producción que la publique para poder verla.' : isNotFound ? 'Revisa la agenda para encontrar las fichas disponibles de esta semana.' : 'Intenta recargar la página en unos segundos.'}</p>
        <a href="/agenda">Ir a la agenda</a>
      </div>
    </main>;
  }

  return <main className="public-ficha-page">
    <header className="public-ficha-header">
      <img src="/logo.png" alt="ARM Global" />
      <a href="/agenda">← Agenda de encuentros</a>
    </header>
    <FichaDocumentView
      ficha={ficha}
      documentMode
      hiddenSections={ficha.hiddenSections ?? []}
      sectionLayout={ficha.sectionLayout}
    />
  </main>;
}
