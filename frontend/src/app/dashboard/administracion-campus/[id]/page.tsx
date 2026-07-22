import type { Metadata } from 'next';
import { CampusDetailClient } from './CampusDetailClient';

export const metadata: Metadata = { title: 'Campus · AR Intranet' };

export default function Page({ params }: { params: { id: string } }) {
  return <CampusDetailClient campusId={Number(params.id)} />;
}
