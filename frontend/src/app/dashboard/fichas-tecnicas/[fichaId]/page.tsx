import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FichaEditorClient } from './FichaEditorClient';

export const metadata: Metadata = { title: 'Editor Ficha | Ecosistema' };

export default function Page({ params }: { params: { fichaId: string } }) {
  // Suspense: requerido por useSearchParams (?edit=1) dentro del client.
  return (
    <Suspense fallback={null}>
      <FichaEditorClient fichaId={params.fichaId} />
    </Suspense>
  );
}
