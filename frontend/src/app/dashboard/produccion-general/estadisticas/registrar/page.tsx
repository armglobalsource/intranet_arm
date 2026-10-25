import { Suspense } from 'react';
import { Metadata } from 'next';
import { RegistrarEncuentroClient } from './RegistrarEncuentroClient';

export const metadata: Metadata = { title: 'Registrar encuentro · ARM' };

export default function RegistrarEncuentroPage() {
  // useSearchParams (enlaces desde el Inicio) necesita un borde de Suspense.
  return <Suspense fallback={null}><RegistrarEncuentroClient /></Suspense>;
}
