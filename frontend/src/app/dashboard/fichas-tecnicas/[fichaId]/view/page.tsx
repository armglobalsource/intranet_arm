import type { Metadata } from 'next';
import { FichaViewClient } from './FichaViewClient';

export const metadata: Metadata = { title: 'Vista Ficha | Intranet' };

export default function Page({ params }: { params: { fichaId: string } }) {
  return <FichaViewClient fichaId={params.fichaId} />;
}
