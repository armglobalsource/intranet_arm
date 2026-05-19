import type { Metadata } from 'next';
import { MisFichasClient } from './MisFichasClient';

export const metadata: Metadata = { title: 'Mis Fichas Técnicas | Intranet' };

export default function MisFichasPage() {
  return <MisFichasClient />;
}
