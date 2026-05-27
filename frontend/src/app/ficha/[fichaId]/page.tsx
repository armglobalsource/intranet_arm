import type { Metadata } from 'next';
import { PublicFichaClient } from './PublicFichaClient';

export const metadata: Metadata = { title: 'Ficha Técnica — ARM Global' };

export default async function PublicFichaPage({
  params,
}: {
  params: Promise<{ fichaId: string }>;
}) {
  const { fichaId } = await params;
  return <PublicFichaClient fichaId={fichaId} />;
}
